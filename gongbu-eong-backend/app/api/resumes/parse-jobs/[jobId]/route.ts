import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { findResumeParseJob } from "@/domains/resumes/resumes.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { jobId } = await context.params;
    const job = await findResumeParseJob(user.id, jobId);

    if (!job) {
      return jsonWithCors(request, { ok: false, message: "분석 작업을 찾을 수 없습니다." }, { status: 404 });
    }

    return jsonWithCors(request, { ok: true, job });
  } catch (error) {
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    const message = error instanceof Error ? error.message : "분석 작업 조회 중 오류가 발생했습니다.";
    return jsonWithCors(request, { ok: false, message }, { status });
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
