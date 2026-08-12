import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { selectResume } from "@/domains/resumes/resumes.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resumeId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { resumeId } = await context.params;
    await selectResume(user.id, resumeId);
    return jsonWithCors(request, { ok: true });
  } catch (error) {
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    const message = error instanceof Error ? error.message : "이력서 선택 중 오류가 발생했습니다.";
    return jsonWithCors(request, { ok: false, message }, { status });
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
