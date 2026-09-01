import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { resolveShortLink } from "@/domains/short-links/short-links.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return jsonWithCors(
      request,
      { ok: false, message: "단축 URL 코드가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const user = await getSessionUser(request).catch(() => null);
  const shortLink = await resolveShortLink({
    code: normalizedCode,
    userId: user?.id,
    ipAddress: getRequestIp(request),
    userAgent: request.headers.get("user-agent"),
    referrer:
      request.headers.get("x-short-link-referrer") ||
      request.headers.get("referer"),
    metadata: {
      requestUrl: request.headers.get("x-short-link-request-url"),
      forwardedFor: request.headers.get("x-forwarded-for"),
    },
  });

  if (!shortLink) {
    return jsonWithCors(
      request,
      { ok: false, message: "단축 URL을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return jsonWithCors(request, {
    ok: true,
    code: shortLink.code,
    targetUrl: shortLink.target_url,
    title: shortLink.title,
    description: shortLink.description,
    channel: shortLink.channel,
    placement: shortLink.placement,
  });
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function normalizeCode(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,39}$/.test(normalized) ? normalized : null;
}

function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
