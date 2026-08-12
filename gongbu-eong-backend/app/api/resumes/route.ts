import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { createResume, listResumes } from "@/domains/resumes/resumes.repository";
import {
  attachResumeFileOnSave,
  getResumeRequestErrorStatus,
  readResumeSaveRequest,
} from "@/domains/resumes/resume-save-request";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const resumes = await listResumes(user.id);
    return jsonWithCors(request, { ok: true, resumes });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const { payload, file } = await readResumeSaveRequest(request);
    const resume = await createResume(user.id, await attachResumeFileOnSave(user.id, payload, file));
    return jsonWithCors(request, { ok: true, resume });
  } catch (error) {
    return handleError(request, error);
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function handleError(request: NextRequest, error: unknown) {
  const status =
    getResumeRequestErrorStatus(error) ||
    (error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500);
  const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
  return jsonWithCors(request, { ok: false, message }, { status });
}
