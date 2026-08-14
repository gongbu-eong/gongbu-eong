import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { findJobPostingById } from "@/domains/jobs/jobs.repository";
import { createPendingResumeFile, validateResumeFile } from "@/domains/resumes/resume-file-storage";
import { findResume } from "@/domains/resumes/resumes.repository";
import { coachResume } from "@/domains/coaching/coaching.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const form = await request.formData();
    const inputType = form.get("inputType") === "file" ? "file" : "text";
    const text = String(form.get("inputText") || "").trim();
    const jobId = String(form.get("jobPostingId") || "").trim() || null;
    const resumeId = String(form.get("resumeId") || "").trim() || null;
    const fileEntry = form.get("file");
    const file = fileEntry instanceof File ? fileEntry : null;
    const allowedCoachingExtensions = new Set(["hwp", "hwpx", "pdf", "doc", "docx"]);
    if (inputType === "text" && !text) return jsonWithCors(request, { ok: false, message: "자소서를 입력해 주세요." }, { status: 400 });
    if (inputType === "text" && text.length > 10000) return jsonWithCors(request, { ok: false, message: "자소서는 10,000자까지 입력할 수 있습니다." }, { status: 400 });
    if (inputType === "file" && !file) return jsonWithCors(request, { ok: false, message: "자소서 파일을 첨부해 주세요." }, { status: 400 });
    if (file && !allowedCoachingExtensions.has(file.name.split(".").pop()?.toLowerCase() || "")) return jsonWithCors(request, { ok: false, message: "HWP, HWPX, PDF, DOC, DOCX 파일만 첨부할 수 있습니다." }, { status: 400 });
    if (file && validateResumeFile(file)) return jsonWithCors(request, { ok: false, message: validateResumeFile(file) }, { status: 400 });
    const selectedResume = resumeId ? await findResume(user.id, resumeId) : null;
    const posting = jobId ? await findJobPostingById(jobId, user.id) : null;
    if (jobId && (!posting || (posting.application_end_at && new Date(posting.application_end_at).getTime() < Date.now()))) return jsonWithCors(request, { ok: false, message: "마감된 공고는 연결할 수 없습니다." }, { status: 400 });
    const savedFile = file ? await createPendingResumeFile(user.id, file) : null;
    const result = await coachResume({ userId: user.id, inputType, inputText: inputType === "file" ? file!.name : text, file: file ? { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) } : undefined, job: posting ? { id: posting.id, institutionName: posting.institution_name, title: posting.title, applicationEndAt: posting.application_end_at ? new Date(posting.application_end_at).toISOString() : null } : null, resumeId, resumeAdditionalNotes: selectedResume?.additionalNotes, sourceFileId: savedFile?.id });
    return jsonWithCors(request, { ok: true, ...result, sourceFile: savedFile });
  } catch (error) {
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    return jsonWithCors(request, { ok: false, message: error instanceof Error ? error.message : "코칭에 실패했습니다." }, { status });
  }
}
