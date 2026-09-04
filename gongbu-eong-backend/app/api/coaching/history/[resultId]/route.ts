import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { findCoachingResult } from "@/domains/coaching/coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ resultId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const item = await findCoachingResult(user.id, (await context.params).resultId);
    if (!item) return jsonWithCors(request, { ok: false, message: "결과를 찾지 못했습니다." }, { status: 404 });
    return jsonWithCors(request, { ok: true, item });
  } catch (error) {
    return jsonWithCors(request, { ok: false, message: error instanceof Error ? error.message : "결과를 불러오지 못했습니다." }, { status: 401 });
  }
}
