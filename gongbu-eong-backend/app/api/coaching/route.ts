import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { findJobPostingById } from "@/domains/jobs/jobs.repository";
import { createPendingResumeFile, validateResumeFile } from "@/domains/resumes/resume-file-storage";
import {
  coachPreparedResume,
  prepareCoachingSource,
  type CoachResumeArgs,
} from "@/domains/coaching/coaching.service";
// import {
//   consumeCoachingCredit,
//   getCurrentCreditBalance,
//   refundCoachingCredit,
// } from "@/domains/credits/credits.repository";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";
import type { CoachingJobDto, CoachingQuestionInput } from "@/domains/coaching/coaching.dto";

export const runtime = "nodejs";
const MAX_QUESTION_COUNT = 10;
const MAX_QUESTION_TEXT_LENGTH = 200;

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    const form = await request.formData();
    const inputType: CoachResumeArgs["inputType"] =
      form.get("inputType") === "file" ? "file" : "text";
    const text = String(form.get("inputText") || "").trim();
    const anonymousId = readAnonymousId(form.get("anonymousId"));
    const jobId = String(form.get("jobPostingId") || "").trim() || null;
    const manualJobTitle = String(form.get("manualJobTitle") || "").trim();
    const jobDuty = String(form.get("jobDuty") || "").trim() || null;
    const questions = parseQuestionInputs(form.get("questions"));
    const fileEntry = form.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const extension = file?.name.split(".").pop()?.toLowerCase() || "";
    const allowedCoachingExtensions = new Set(["hwp", "hwpx", "pdf", "docx"]);
    if (!user && !anonymousId) return jsonWithCors(request, { ok: false, message: "익명 사용자 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요." }, { status: 400 });
    if (inputType === "text" && !text) return jsonWithCors(request, { ok: false, message: "자소서를 입력해 주세요." }, { status: 400 });
    if (inputType === "text" && text.length > 10000) return jsonWithCors(request, { ok: false, message: "자소서는 10,000자까지 입력할 수 있습니다." }, { status: 400 });
    if (inputType === "file" && !file) return jsonWithCors(request, { ok: false, message: "자소서 파일을 첨부해 주세요." }, { status: 400 });
    if (!questions.length || questions.length > MAX_QUESTION_COUNT || questions.some((item) => !item.question || !item.characterLimit || item.characterLimit < 100 || item.characterLimit > 2000)) {
      return jsonWithCors(request, { ok: false, message: "자소서 문항과 100자 이상 2000자 이하의 글자 수 제한을 입력해 주세요." }, { status: 400 });
    }
    if (questions.some((item) => item.question.length > MAX_QUESTION_TEXT_LENGTH)) {
      return jsonWithCors(request, { ok: false, message: `자소서 문항은 ${MAX_QUESTION_TEXT_LENGTH}자까지 입력할 수 있습니다.` }, { status: 400 });
    }
    if (file && !allowedCoachingExtensions.has(extension)) return jsonWithCors(request, { ok: false, message: "HWP, HWPX, PDF, DOCX 파일만 첨부할 수 있습니다." }, { status: 400 });
    const fileValidationMessage = file ? validateResumeFile(file) : null;
    if (fileValidationMessage) return jsonWithCors(request, { ok: false, message: fileValidationMessage }, { status: 400 });
    const posting = jobId ? await findJobPostingById(jobId, user?.id) : null;
    if (jobId && (!posting || (posting.application_end_at && new Date(posting.application_end_at).getTime() < Date.now()))) return jsonWithCors(request, { ok: false, message: "마감된 공고는 연결할 수 없습니다." }, { status: 400 });
    const manualJob: CoachingJobDto | null = !posting && manualJobTitle ? {
      id: `manual:${manualJobTitle.slice(0, 80)}`,
      institutionName: "직접 입력",
      title: manualJobTitle.slice(0, 200),
      applicationEndAt: null,
    } : null;
    const filePayload = file ? { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) } : undefined;
    const coachingArgs: CoachResumeArgs = {
      userId: user?.id || null,
      anonymousId: user ? null : anonymousId,
      inputType,
      inputText: inputType === "file" ? file?.name || "" : text,
      file: filePayload,
      jobPostingId: posting?.id || null,
      job: posting ? {
        id: posting.id,
        institutionName: posting.institution_name,
        title: posting.title,
        applicationEndAt: posting.application_end_at ? new Date(posting.application_end_at).toISOString() : null,
      } : manualJob,
      jobDuty,
      // 강점·성향 진단 결과는 코칭 입력에서 제외합니다.
      questions,
      resumeId: null,
      resumeAdditionalNotes: null,
      sourceFileId: null,
    };
    const preparedSource = await prepareCoachingSource(coachingArgs);
    const savedFile = file && user ? await createPendingResumeFile(user.id, file) : null;
    // 진단권 소모 로직 비활성화: 잔액 확인, 차감, 실패 시 환불을 수행하지 않습니다.
    // const currentCreditBalance = await getCurrentCreditBalance(user.id);
    // if (currentCreditBalance < 1) {
    //   return jsonWithCors(
    //     request,
    //     {
    //       ok: false,
    //       message: "진단권이 부족합니다. 커뮤니티에서 글 또는 댓글을 작성하거나, 충전을 해주세요.",
    //       creditBalance: currentCreditBalance,
    //     },
    //     { status: 402 },
    //   );
    // }

    const result = await coachPreparedResume(
      { ...coachingArgs, sourceFileId: savedFile?.id || null },
      preparedSource,
    );
    // let creditUsage: Awaited<ReturnType<typeof consumeCoachingCredit>> | null = null;
    // try {
    //   creditUsage = await consumeCoachingCredit(user.id, result.resultId);
    //   if (!creditUsage.consumed) {
    //     return jsonWithCors(
    //       request,
    //       {
    //         ok: false,
    //         message: "진단권이 부족합니다. 커뮤니티에서 글 또는 댓글을 작성하거나, 충전을 해주세요.",
    //         creditBalance: creditUsage.balanceAfter,
    //       },
    //       { status: 402 },
    //     );
    //   }
    //   return jsonWithCors(request, { ok: true, ...result, sourceFile: savedFile, creditBalance: creditUsage.balanceAfter });
    // } catch (error) {
    //   const refund = creditUsage?.consumed
    //     ? await refundCoachingCredit(user.id, result.resultId).catch((refundError) => {
    //         console.error("[Coaching] credit refund failed", refundError);
    //         return null;
    //       })
    //     : null;
    //   return jsonWithCors(
    //     request,
    //     {
    //       ok: false,
    //       message: error instanceof Error ? error.message : "코칭에 실패했습니다.",
    //       creditBalance: refund?.balanceAfter ?? creditUsage?.balanceAfter ?? await getCurrentCreditBalance(user.id).catch(() => undefined),
    //     },
    //     { status: 500 },
    //   );
    // }
    return jsonWithCors(request, { ok: true, ...result, sourceFile: savedFile });
  } catch (error) {
    return jsonWithCors(request, { ok: false, message: error instanceof Error ? error.message : "코칭에 실패했습니다." }, { status: 500 });
  }
}

function readAnonymousId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !isUuid(value.trim())) return null;
  return value.trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseQuestionInputs(value: FormDataEntryValue | null): CoachingQuestionInput[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const question = typeof record.question === "string" ? record.question.trim() : "";
        const rawLimit = Number(record.characterLimit);
        const characterLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(2000, Math.round(rawLimit)) : null;
        return question || characterLimit ? { question, characterLimit } : null;
      })
      .filter(Boolean) as CoachingQuestionInput[];
  } catch {
    return [];
  }
}
