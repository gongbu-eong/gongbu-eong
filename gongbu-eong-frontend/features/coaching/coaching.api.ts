import type { CoachingFeedback, CoachingHistoryItem, CoachingJob } from "./coaching.dto";

export async function coachResume(args: { inputType: "text" | "file"; inputText: string; file?: File | null; jobPostingId?: string | null; resumeId?: string | null }) {
  const form = new FormData();
  form.set("inputType", args.inputType);
  form.set("inputText", args.inputText);
  if (args.jobPostingId) form.set("jobPostingId", args.jobPostingId);
  if (args.resumeId) form.set("resumeId", args.resumeId);
  if (args.file) form.set("file", args.file);
  const response = await fetch("/api/coaching", { method: "POST", body: form, credentials: "include", cache: "no-store" });
  const body = await response.json() as { ok: boolean; message?: string; resultId: string; requestId: string; feedback: CoachingFeedback; sourceFile?: { id: string; originalFilename: string } };
  if (!response.ok || !body.ok) throw new Error(body.message || "코칭에 실패했습니다.");
  return body;
}
export async function listCoachingHistory() {
  const response = await fetch("/api/coaching/history", { credentials: "include", cache: "no-store" });
  const body = await response.json() as { ok: boolean; items: CoachingHistoryItem[]; message?: string };
  if (!response.ok || !body.ok) throw new Error(body.message || "기록을 불러오지 못했습니다.");
  return body;
}
export async function getCoachingResult(resultId: string) {
  const response = await fetch(`/api/coaching/history/${encodeURIComponent(resultId)}`, { credentials: "include", cache: "no-store" });
  const body = await response.json() as { ok: boolean; item: CoachingHistoryItem; message?: string };
  if (!response.ok || !body.ok) throw new Error(body.message || "결과를 불러오지 못했습니다.");
  return body;
}
export type { CoachingFeedback, CoachingHistoryItem, CoachingJob };
