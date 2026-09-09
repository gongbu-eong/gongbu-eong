import { getAnonymousId } from "@/shared/session/anonymous-id";
import type {
  InterviewAnswerFeedback,
  InterviewCoachingSession,
} from "./interview-coaching.dto";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function startInterviewCoaching(args: {
  jobPostingId?: string | null;
  manualCompanyName?: string | null;
  manualPositionName?: string | null;
  jobDuty?: string | null;
  anonymousId?: string | null;
}) {
  const response = await fetch(`${backendUrl}/api/interview-coaching`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...args,
      anonymousId: args.anonymousId || getAnonymousId(),
    }),
  });
  const body = await readJsonResponse(response) as {
    ok: boolean;
    session: InterviewCoachingSession;
    message?: string;
  };
  if (!response.ok || !body.ok) throw new Error(body.message || "면접 코칭을 시작하지 못했습니다.");
  return body;
}

export async function answerInterviewQuestion(args: {
  sessionId: string;
  questionId: string;
  answer: string;
  anonymousId?: string | null;
}) {
  const response = await fetch(
    `${backendUrl}/api/interview-coaching/${encodeURIComponent(args.sessionId)}/answer`,
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousId: args.anonymousId || getAnonymousId(),
        questionId: args.questionId,
        answer: args.answer,
      }),
    },
  );
  const body = await readJsonResponse(response) as {
    ok: boolean;
    session: InterviewCoachingSession;
    feedback: InterviewAnswerFeedback;
    followUpQuestion: string | null;
    message?: string;
  };
  if (!response.ok || !body.ok) throw new Error(body.message || "답변 코칭에 실패했습니다.");
  return body;
}

export async function completeInterviewCoaching(args: {
  sessionId: string;
  anonymousId?: string | null;
}) {
  const response = await fetch(
    `${backendUrl}/api/interview-coaching/${encodeURIComponent(args.sessionId)}/complete`,
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousId: args.anonymousId || getAnonymousId() }),
    },
  );
  const body = await readJsonResponse(response) as {
    ok: boolean;
    session: InterviewCoachingSession;
    message?: string;
  };
  if (!response.ok || !body.ok) throw new Error(body.message || "면접 결과 생성에 실패했습니다.");
  return body;
}

export async function getInterviewCoachingSession(
  sessionId: string,
  anonymousId?: string | null,
) {
  const searchParams = new URLSearchParams();
  if (anonymousId) searchParams.set("anonymousId", anonymousId);
  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  const response = await fetch(
    `${backendUrl}/api/interview-coaching/${encodeURIComponent(sessionId)}${query}`,
    { credentials: "include", cache: "no-store" },
  );
  const body = await readJsonResponse(response) as {
    ok: boolean;
    session: InterviewCoachingSession;
    message?: string;
  };
  if (!response.ok || !body.ok) throw new Error(body.message || "면접 코칭 결과를 불러오지 못했습니다.");
  return body;
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("AI 면접 코칭 처리 중 서버 응답 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("AI 면접 코칭 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
