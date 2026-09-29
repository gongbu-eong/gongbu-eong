import { after, NextRequest } from "next/server";
import { beginProductActivity } from "@/domains/analytics/product-activity";
import { wakeAnalyticsFactWorker } from "@/lib/analytics-fact-worker";
import { requireSessionUser } from "@/domains/auth/session";
import { answerInterviewQuestion } from "@/domains/interview-coaching/interview-coaching.service";
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
    const questionId = readString(body.questionId);
    const answer = readString(body.answer);
    const { sessionId } = await context.params;

    if (!questionId) {
      return jsonWithCors(request, { ok: false, message: "면접 질문을 선택해 주세요." }, { status: 400 });
    }
    if (!answer) {
      return jsonWithCors(request, { ok: false, message: "답변을 입력해 주세요." }, { status: 400 });
    }

    activity = await beginProductActivity({
      request, userId: user.id, anonymousId, screen: "interview_coaching",
      startEvent: "interview_coaching_answer_submit", completeEvent: "interview_coaching_answer", failureEvent: "interview_coaching_answer_failed",
      properties: { interview_session_id: sessionId, question_id: questionId },
    });
    after(wakeAnalyticsFactWorker);
    const result = await answerInterviewQuestion({
      sessionId,
      questionId,
      answer,
      userId: user.id,
      anonymousId: null,
    });

    await activity.complete({ has_follow_up_question: Boolean(result.followUpQuestion) });
    return jsonWithCors(request, { ok: true, ...result });
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
            : "답변 코칭에 실패했습니다.",
      },
      { status },
    );
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readAnonymousId(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}
