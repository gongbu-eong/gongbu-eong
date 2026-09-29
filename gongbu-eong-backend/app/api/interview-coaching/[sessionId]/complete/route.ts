import { after, NextRequest } from "next/server";
import { beginProductActivity } from "@/domains/analytics/product-activity";
import { wakeAnalyticsFactWorker } from "@/lib/analytics-fact-worker";
import { requireSessionUser } from "@/domains/auth/session";
import { completeInterviewCoaching } from "@/domains/interview-coaching/interview-coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  let activity: Awaited<ReturnType<typeof beginProductActivity>> | undefined;
  try {
    const user = await requireSessionUser(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const anonymousId = readAnonymousId(body.anonymousId);
    const { sessionId } = await context.params;

    activity = await beginProductActivity({
      request, userId: user.id, anonymousId, screen: "interview_coaching",
      startEvent: "interview_coaching_complete_start", completeEvent: "interview_coaching_complete", failureEvent: "interview_coaching_complete_failed",
      properties: { interview_session_id: sessionId },
    });
    after(wakeAnalyticsFactWorker);
    const session = await completeInterviewCoaching({
      sessionId,
      userId: user.id,
      anonymousId: null,
    });

    await activity.complete({ answered_question_count: session.messages.filter((item) => item.role === "answer").length });
    return jsonWithCors(request, { ok: true, session });
  } catch (error) {
    await activity?.fail();
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401
      : error instanceof Error && error.name === "NotFoundError" ? 404 : 500;
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "면접 결과 생성에 실패했습니다.",
      },
      { status },
    );
  }
}

function readAnonymousId(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}
