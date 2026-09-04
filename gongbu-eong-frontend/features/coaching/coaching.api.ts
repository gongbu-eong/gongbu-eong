import type { CoachingFeedback, CoachingHistoryItem, CoachingJob, CoachingQuestionInput } from "./coaching.dto";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function coachResume(args: { inputType: "text" | "file"; inputText: string; file?: File | null; jobPostingId?: string | null; resumeId?: string | null; jobDuty?: string | null; diagnosisResultId?: string | null; questions?: CoachingQuestionInput[] }) {
  const form = new FormData();
  form.set("inputType", args.inputType);
  form.set("inputText", args.inputText);
  if (args.jobPostingId) form.set("jobPostingId", args.jobPostingId);
  if (args.resumeId) form.set("resumeId", args.resumeId);
  if (args.jobDuty) form.set("jobDuty", args.jobDuty);
  if (args.diagnosisResultId) form.set("diagnosisResultId", args.diagnosisResultId);
  if (args.questions?.length) form.set("questions", JSON.stringify(args.questions));
  if (args.file) form.set("file", args.file);
  const response = await fetch(`${backendUrl}/api/coaching`, { method: "POST", body: form, credentials: "include", cache: "no-store" });
  const body = await readJsonResponse(response) as { ok: boolean; message?: string; resultId: string; requestId: string; feedback: CoachingFeedback; sourceFile?: { id: string; originalFilename: string }; creditBalance?: number };
  if (!response.ok || !body.ok) {
    if (typeof body.creditBalance === "number") {
      window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
        detail: { balance: body.creditBalance },
      }));
    }
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
export async function getCoachingResult(resultId: string) {
  const response = await fetch(`${backendUrl}/api/coaching/history/${encodeURIComponent(resultId)}`, { credentials: "include", cache: "no-store" });
  const body = await response.json() as { ok: boolean; item: CoachingHistoryItem; message?: string };
  if (!response.ok || !body.ok) throw new Error(body.message || "결과를 불러오지 못했습니다.");
  return body;
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      "AI 자소서 코칭 처리 중 서버 응답 오류가 발생했습니다. 진단권이 차감된 경우 자동 환불됩니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      "AI 자소서 코칭 응답을 읽지 못했습니다. 진단권이 차감된 경우 자동 환불됩니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
export type { CoachingFeedback, CoachingHistoryItem, CoachingJob };
