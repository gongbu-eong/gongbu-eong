import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/domains/auth/session";
import { findJobPostingById } from "@/domains/jobs/jobs.repository";
import { startInterviewCoaching } from "@/domains/interview-coaching/interview-coaching.service";
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
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  try {
    console.info(`[InterviewCoaching:${requestId}] POST /api/interview-coaching start`);
    console.info(`[InterviewCoaching:${requestId}] auth:start`);
    const user = await getSessionUser(request);
    console.info(`[InterviewCoaching:${requestId}] auth:done`, {
      hasUser: Boolean(user),
      elapsedMs: Date.now() - startedAt,
    });

    const body = (await request.json()) as Record<string, unknown>;
    const anonymousId = readAnonymousId(body.anonymousId);
    console.info(`[InterviewCoaching:${requestId}] request:parsed`, {
      hasAnonymousId: Boolean(anonymousId),
      hasJobPostingId: Boolean(readString(body.jobPostingId)),
      hasManualCompanyName: Boolean(readString(body.manualCompanyName)),
      hasManualPositionName: Boolean(readString(body.manualPositionName)),
      hasJobDuty: Boolean(readString(body.jobDuty)),
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

    const jobPostingId = readString(body.jobPostingId);
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
      manualCompanyName: readString(body.manualCompanyName),
      manualPositionName: readString(body.manualPositionName),
      jobDuty: readString(body.jobDuty),
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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readAnonymousId(value: unknown) {
  const text = readString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}
