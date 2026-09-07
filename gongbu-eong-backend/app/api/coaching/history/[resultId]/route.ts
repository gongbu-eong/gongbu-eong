import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { findCoachingResultForViewer } from "@/domains/coaching/coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ resultId: string }> }) {
  try {
    const user = await getSessionUser(request);
    const anonymousId = readAnonymousId(request.nextUrl.searchParams.get("anonymousId"));
    const item = await findCoachingResultForViewer({
      resultId: (await context.params).resultId,
      userId: user?.id || null,
      anonymousId,
    });
    if (!item) return jsonWithCors(request, { ok: false, message: "결과를 찾지 못했습니다." }, { status: 404 });
    return jsonWithCors(request, { ok: true, item: { ...item, isLocked: !user && item.isAnonymous } });
  } catch (error) {
    return jsonWithCors(request, { ok: false, message: error instanceof Error ? error.message : "결과를 불러오지 못했습니다." }, { status: 500 });
  }
}

function readAnonymousId(value: string | null) {
  if (!value || !isUuid(value.trim())) return null;
  return value.trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
