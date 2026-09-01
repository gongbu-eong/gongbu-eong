import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

type ResolveShortLinkResponse = {
  ok: boolean;
  targetUrl?: string;
  message?: string;
};

const backendUrl =
  process.env.GONGBUEONG_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";

export async function GET(request: NextRequest, context: RouteContext) {
  const { code } = await context.params;
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return redirectToFallback(request, "invalid");
  }

  try {
    const response = await fetch(
      new URL(
        `/api/short-links/${encodeURIComponent(normalizedCode)}/resolve`,
        backendUrl,
      ),
      {
        cache: "no-store",
        headers: createForwardHeaders(request),
      },
    );

    if (!response.ok) {
      return redirectToFallback(request, "not_found");
    }

    const body = (await response.json()) as ResolveShortLinkResponse;
    const targetUrl = normalizeTargetUrl(body.targetUrl, request);

    if (!body.ok || !targetUrl) {
      return redirectToFallback(request, "not_found");
    }

    return NextResponse.redirect(targetUrl, 302);
  } catch (error) {
    console.error("Failed to resolve short link", error);
    return redirectToFallback(request, "unavailable");
  }
}

function createForwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (cookie) headers.set("cookie", cookie);
  if (userAgent) headers.set("user-agent", userAgent);
  if (referer) headers.set("x-short-link-referrer", referer);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  if (realIp) headers.set("x-real-ip", realIp);

  headers.set("x-short-link-request-url", request.url);

  return headers;
}

function normalizeCode(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,39}$/.test(normalized) ? normalized : null;
}

function normalizeTargetUrl(value: string | undefined, request: NextRequest) {
  if (!value) return null;

  try {
    const url = new URL(value, request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function redirectToFallback(request: NextRequest, error: string) {
  const fallbackUrl = new URL("/", request.url);
  fallbackUrl.searchParams.set("shortLinkError", error);
  return NextResponse.redirect(fallbackUrl, 302);
}
