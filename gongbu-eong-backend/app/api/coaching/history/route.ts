import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { listCoachingHistory } from "@/domains/coaching/coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    return jsonWithCors(request, { ok: true, items: await listCoachingHistory(user.id) });
  } catch (error) {
    return jsonWithCors(request, { ok: false, message: error instanceof Error ? error.message : "기록을 불러오지 못했습니다." }, { status: 401 });
  }
}
