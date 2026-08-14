import { db } from "@/lib/db";
import type { CoachingFeedback, CoachingHistoryDto, CoachingInputType, CoachingJobDto } from "./coaching.dto";

type Row = { result_id: string; request_id: string; created_at: string; input_type: CoachingInputType; source_filename: string | null; input_text: string; job_posting_snapshot: CoachingJobDto | null; feedback: CoachingFeedback | null };

export async function createCoachingRequest(args: { userId: string; jobPostingId?: string | null; jobSnapshot?: CoachingJobDto | null; resumeId?: string | null; inputType: CoachingInputType; sourceFileId?: string | null; sourceFilename?: string | null; inputText: string }) {
  const result = await db.query<{ id: string }>("INSERT INTO public.resume_coaching_requests (user_id, job_posting_id, resume_id, input_type, source_file_id, source_filename, input_text, job_posting_snapshot, entry_source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'ai_tools') RETURNING id", [args.userId, args.jobPostingId || null, args.resumeId || null, args.inputType, args.sourceFileId || null, args.sourceFilename || null, args.inputText, JSON.stringify(args.jobSnapshot || {})]);
  return result.rows[0].id;
}

export async function createCoachingResult(requestId: string, feedback: CoachingFeedback, modelName: string) {
  const result = await db.query<{ id: string }>("INSERT INTO public.resume_coaching_results (request_id, score, corrected_text, feedback, model_name) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id", [requestId, feedback.score, feedback.sentenceEdits.map((item) => item.improved).join("\\n"), JSON.stringify(feedback), modelName]);
  return result.rows[0].id;
}

export async function listCoachingHistory(userId: string) {
  const result = await db.query<Row>("SELECT results.id AS result_id, requests.id AS request_id, results.created_at, requests.input_type, requests.source_filename, requests.input_text, requests.job_posting_snapshot, results.feedback FROM public.resume_coaching_results results JOIN public.resume_coaching_requests requests ON requests.id = results.request_id WHERE requests.user_id = $1 ORDER BY results.created_at DESC", [userId]);
  return result.rows.map(mapRow);
}

export async function findCoachingResult(userId: string, resultId: string) {
  const result = await db.query<Row>("SELECT results.id AS result_id, requests.id AS request_id, results.created_at, requests.input_type, requests.source_filename, requests.input_text, requests.job_posting_snapshot, results.feedback FROM public.resume_coaching_results results JOIN public.resume_coaching_requests requests ON requests.id = results.request_id WHERE requests.user_id = $1 AND results.id = $2 LIMIT 1", [userId, resultId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

function mapRow(row: Row): CoachingHistoryDto {
  return { id: row.result_id, requestId: row.request_id, createdAt: row.created_at, inputType: row.input_type, sourceFilename: row.source_filename, inputText: row.input_text || "", job: row.job_posting_snapshot && row.job_posting_snapshot.id ? row.job_posting_snapshot : null, result: row.feedback };
}
