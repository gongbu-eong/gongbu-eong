import type { CoachingFeedback, CoachingHistoryItem, CoachingJob, CoachingQuestionInput } from "./coaching.dto";
import { getAnonymousId } from "@/shared/session/anonymous-id";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function coachResume(args: { inputType: "text" | "file"; inputText: string; file?: File | null; jobPostingId?: string | null; manualJobTitle?: string | null; resumeId?: string | null; jobDuty?: string | null; questions?: CoachingQuestionInput[]; anonymousId?: string | null }) {
  const form = new FormData();
  form.set("inputType", args.inputType);
  form.set("inputText", args.inputText);
  form.set("anonymousId", args.anonymousId || getAnonymousId());
  if (args.jobPostingId) form.set("jobPostingId", args.jobPostingId);
  if (args.manualJobTitle) form.set("manualJobTitle", args.manualJobTitle);
  if (args.resumeId) form.set("resumeId", args.resumeId);
  if (args.jobDuty) form.set("jobDuty", args.jobDuty);
  if (args.questions?.length) form.set("questions", JSON.stringify(args.questions));
  if (args.file) form.set("file", args.file);
  const response = await fetch(`${backendUrl}/api/coaching`, { method: "POST", body: form, credentials: "include", cache: "no-store" });
  const body = await readJsonResponse(response) as { ok: boolean; message?: string; resultId: string; requestId: string; feedback: CoachingFeedback; sourceFile?: { id: string; originalFilename: string } };
  if (!response.ok || !body.ok) {
    // 진단권 잔액 동기화 로직 비활성화.
    // if (typeof body.creditBalance === "number") {
    //   window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
    //     detail: { balance: body.creditBalance },
    //   }));
    // }
    throw new Error(body.message || "코칭에 실패했습니다.");
  }
  return body;
}
export async function listCoachingHistory() {
  const response = await fetch(`${backendUrl}/api/coaching/history`, { credentials: "include", cache: "no-store" });
  const body = await response.json() as { ok: boolean; items: CoachingHistoryItem[]; message?: string };
  if (!response.ok || !body.ok) throw new Error(body.message || "기록을 불러오지 못했습니다.");
  return body;
}
export async function getCoachingResult(resultId: string, anonymousId?: string | null) {
  const searchParams = new URLSearchParams();
  if (anonymousId) searchParams.set("anonymousId", anonymousId);
  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  const response = await fetch(`${backendUrl}/api/coaching/history/${encodeURIComponent(resultId)}${query}`, { credentials: "include", cache: "no-store" });
  const body = await response.json() as { ok: boolean; item: CoachingHistoryItem; message?: string };
  if (!response.ok || !body.ok) throw new Error(body.message || "결과를 불러오지 못했습니다.");
  return body;
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("AI 자소서 코칭 처리 중 서버 응답 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("AI 자소서 코칭 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
export type { CoachingFeedback, CoachingHistoryItem, CoachingJob };
