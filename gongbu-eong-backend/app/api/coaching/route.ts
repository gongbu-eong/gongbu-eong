import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { randomUUID } from "crypto";
import { findJobPostingById } from "@/domains/jobs/jobs.repository";
import { createPendingResumeFile, validateResumeFile } from "@/domains/resumes/resume-file-storage";
import { coachResume } from "@/domains/coaching/coaching.service";
import {
  consumeCoachingCredit,
  refundCoachingCredit,
} from "@/domains/credits/credits.repository";
import { jsonWithCors } from "@/lib/cors";
import type { CoachingQuestionInput } from "@/domains/coaching/coaching.dto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const form = await request.formData();
    const inputType = form.get("inputType") === "file" ? "file" : "text";
    const text = String(form.get("inputText") || "").trim();
    const jobId = String(form.get("jobPostingId") || "").trim() || null;
    const jobDuty = String(form.get("jobDuty") || "").trim() || null;
    const questions = parseQuestionInputs(form.get("questions"));
    const fileEntry = form.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const allowedCoachingExtensions = new Set(["hwp", "hwpx", "pdf", "doc", "docx"]);
    if (inputType === "text" && !text) return jsonWithCors(request, { ok: false, message: "자소서를 입력해 주세요." }, { status: 400 });
    if (inputType === "text" && text.length > 10000) return jsonWithCors(request, { ok: false, message: "자소서는 10,000자까지 입력할 수 있습니다." }, { status: 400 });
    if (inputType === "file" && !file) return jsonWithCors(request, { ok: false, message: "자소서 파일을 첨부해 주세요." }, { status: 400 });
    if (!questions.length || questions.length > 5 || questions.some((item) => !item.question || !item.characterLimit || item.characterLimit < 100 || item.characterLimit > 2000)) {
      return jsonWithCors(request, { ok: false, message: "자소서 문항과 100자 이상 2000자 이하의 글자 수 제한을 입력해 주세요." }, { status: 400 });
    }
    if (file && !allowedCoachingExtensions.has(file.name.split(".").pop()?.toLowerCase() || "")) return jsonWithCors(request, { ok: false, message: "HWP, HWPX, PDF, DOC, DOCX 파일만 첨부할 수 있습니다." }, { status: 400 });
    const fileValidationMessage = file ? validateResumeFile(file) : null;
    if (fileValidationMessage) return jsonWithCors(request, { ok: false, message: fileValidationMessage }, { status: 400 });
    const posting = jobId ? await findJobPostingById(jobId, user.id) : null;
    if (jobId && (!posting || (posting.application_end_at && new Date(posting.application_end_at).getTime() < Date.now()))) return jsonWithCors(request, { ok: false, message: "마감된 공고는 연결할 수 없습니다." }, { status: 400 });
    const savedFile = file ? await createPendingResumeFile(user.id, file) : null;
    const creditSourceId = randomUUID();
    const creditUsage = await consumeCoachingCredit(user.id, creditSourceId);
    if (!creditUsage.consumed) {
      return jsonWithCors(
        request,
        {
          ok: false,
          message: "진단권이 부족합니다. 커뮤니티에서 글 또는 댓글을 작성하거나, 충전을 해주세요.",
          creditBalance: creditUsage.balanceAfter,
        },
        { status: 402 },
      );
    }

    try {
      const result = await coachResume({ userId: user.id, inputType, inputText: inputType === "file" ? file!.name : text, file: file ? { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) } : undefined, job: posting ? { id: posting.id, institutionName: posting.institution_name, title: posting.title, applicationEndAt: posting.application_end_at ? new Date(posting.application_end_at).toISOString() : null } : null, jobDuty, questions, resumeId: null, resumeAdditionalNotes: null, sourceFileId: savedFile?.id });
      return jsonWithCors(request, { ok: true, ...result, sourceFile: savedFile, creditBalance: creditUsage.balanceAfter });
    } catch (error) {
      await refundCoachingCredit(user.id, creditSourceId).catch((refundError) => {
        console.error("[Coaching] credit refund failed", refundError);
      });
      throw error;
    }
  } catch (error) {
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    return jsonWithCors(request, { ok: false, message: error instanceof Error ? error.message : "코칭에 실패했습니다." }, { status });
  }
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
        const question = typeof record.question === "string" ? record.question.trim().slice(0, 500) : "";
        const rawLimit = Number(record.characterLimit);
        const characterLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(2000, Math.round(rawLimit)) : null;
        return question || characterLimit ? { question, characterLimit } : null;
      })
      .filter(Boolean) as CoachingQuestionInput[];
  } catch {
    return [];
  }
}
