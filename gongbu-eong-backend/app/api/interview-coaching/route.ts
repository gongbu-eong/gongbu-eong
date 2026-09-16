import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/domains/auth/session";
import { findJobPostingById } from "@/domains/jobs/jobs.repository";
import { startInterviewCoaching } from "@/domains/interview-coaching/interview-coaching.service";
import { validateResumeFile } from "@/domains/resumes/resume-file-storage";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const ipAddress = getRequestIp(request);

  try {
    console.info(`[InterviewCoaching:${requestId}] POST /api/interview-coaching start`);
    console.info(`[InterviewCoaching:${requestId}] auth:start`);
    const user = await getSessionUser(request);
    console.info(`[InterviewCoaching:${requestId}] auth:done`, {
      hasUser: Boolean(user),
      elapsedMs: Date.now() - startedAt,
    });

    const payload = await readInterviewStartPayload(request);
    const anonymousId = readAnonymousId(payload.anonymousId);
    console.info(`[InterviewCoaching:${requestId}] request:parsed`, {
      hasAnonymousId: Boolean(anonymousId),
      hasJobPostingId: Boolean(readString(payload.jobPostingId)),
      hasManualCompanyName: Boolean(readString(payload.manualCompanyName)),
      hasManualPositionName: Boolean(readString(payload.manualPositionName)),
      hasJobDuty: Boolean(readString(payload.jobDuty)),
      materialInputType: payload.materialInputType,
      hasMaterialFile: Boolean(payload.materialFile),
    });

    if (!user && !anonymousId) {
      return jsonWithCors(
        request,
        {
          ok: false,
          message:
            "익명 사용자 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.",
        },
        { status: 400 },
      );
    }

    if (!payload.termsAgreed) {
      return jsonWithCors(
        request,
        { ok: false, message: "AI NCS 면접 약관동의를 완료해 주세요." },
        { status: 400 },
      );
    }

    if (payload.materialFile) {
      if (payload.materialFile.size > 10 * 1024 * 1024) {
        return jsonWithCors(
          request,
          { ok: false, message: "면접 자료 파일은 10MB 이하만 첨부할 수 있습니다." },
          { status: 400 },
        );
      }
      const validationMessage = validateResumeFile(payload.materialFile);
      if (validationMessage) {
        return jsonWithCors(request, { ok: false, message: validationMessage }, { status: 400 });
      }
    }

    const jobPostingId = readString(payload.jobPostingId);
    console.info(`[InterviewCoaching:${requestId}] job:lookup:start`, {
      jobPostingId: jobPostingId || null,
    });
    const posting = jobPostingId
      ? await findJobPostingById(jobPostingId, user?.id)
      : null;
    console.info(`[InterviewCoaching:${requestId}] job:lookup:done`, {
      hasPosting: Boolean(posting),
      elapsedMs: Date.now() - startedAt,
    });

    if (jobPostingId && !posting) {
      return jsonWithCors(
        request,
        { ok: false, message: "연결할 공고를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const session = await startInterviewCoaching({
      userId: user?.id || null,
      anonymousId,
      posting,
      manualCompanyName: readString(payload.manualCompanyName),
      manualPositionName: readString(payload.manualPositionName),
      jobDuty: readString(payload.jobDuty),
      materialInputType: payload.materialInputType,
      materialText: readString(payload.materialText),
      materialFile: payload.materialFile
        ? {
            name: payload.materialFile.name,
            type: payload.materialFile.type,
            buffer: Buffer.from(await payload.materialFile.arrayBuffer()),
          }
        : null,
      termsAgreed: payload.termsAgreed,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
      traceId: requestId,
    });

    console.info(`[InterviewCoaching:${requestId}] POST /api/interview-coaching success`, {
      sessionId: session.id,
      elapsedMs: Date.now() - startedAt,
    });
    return jsonWithCors(request, { ok: true, session }, { status: 201 });
  } catch (error) {
    console.error(`[InterviewCoaching:${requestId}] POST /api/interview-coaching failed`, {
      elapsedMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return jsonWithCors(
      request,
      {
        ok: false,
        requestId,
        message:
          error instanceof Error && error.message
            ? error.message
            : "AI NCS 면접 코칭을 시작하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

async function readInterviewStartPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    const materialFileEntry = form.get("materialFile");
    return {
      anonymousId: form.get("anonymousId"),
      jobPostingId: form.get("jobPostingId"),
      manualCompanyName: form.get("manualCompanyName"),
      manualPositionName: form.get("manualPositionName"),
      jobDuty: form.get("jobDuty"),
      materialInputType: form.get("materialInputType") === "file" ? "file" as const : "text" as const,
      materialText: form.get("materialText"),
      materialFile: materialFileEntry instanceof File ? materialFileEntry : null,
      termsAgreed: form.get("termsAgreed") === "true",
    };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return {
    anonymousId: body.anonymousId,
    jobPostingId: body.jobPostingId,
    manualCompanyName: body.manualCompanyName,
    manualPositionName: body.manualPositionName,
    jobDuty: body.jobDuty,
    materialInputType: body.materialInputType === "file" ? "file" as const : "text" as const,
    materialText: body.materialText,
    materialFile: null,
    termsAgreed: body.termsAgreed === true,
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const rawIp =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  return normalizeIp(rawIp);
}

function normalizeIp(value: string) {
  const text = value.trim();
  if (!text || text.toLowerCase() === "unknown") return undefined;
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(text)) {
    return text.split(":")[0];
  }
  return text;
}

function readAnonymousId(value: unknown) {
  const text = readString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}
