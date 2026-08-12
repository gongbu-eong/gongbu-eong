import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import {
  deleteResume,
  findResume,
  updateResume,
} from "@/domains/resumes/resumes.repository";
import {
  attachResumeFileOnSave,
  getResumeRequestErrorStatus,
  readResumeSaveRequest,
} from "@/domains/resumes/resume-save-request";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resumeId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { resumeId } = await context.params;
    const resume = await findResume(user.id, resumeId);

    if (!resume) {
      return jsonWithCors(request, { ok: false, message: "이력서를 찾을 수 없습니다." }, { status: 404 });
    }

    return jsonWithCors(request, { ok: true, resume });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ resumeId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { resumeId } = await context.params;
    const { payload, file } = await readResumeSaveRequest(request);
    const resume = await updateResume(
      user.id,
      resumeId,
      await attachResumeFileOnSave(user.id, payload, file),
    );
    return jsonWithCors(request, { ok: true, resume });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ resumeId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { resumeId } = await context.params;
    await deleteResume(user.id, resumeId);
    return jsonWithCors(request, { ok: true });
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
