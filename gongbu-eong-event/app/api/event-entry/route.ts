import { NextRequest, NextResponse } from "next/server";
import { EVENT_SESSION_COOKIE } from "@/shared/event-session";

export const runtime = "nodejs";

const mainBackendUrl =
  process.env.GONGBUEONG_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket");
  const nextPath = normalizeNextPath(request.nextUrl.searchParams.get("next"));

  if (!ticket) {
    return NextResponse.redirect(new URL("/", getMainAppUrl()), 302);
  }

  const response = await fetch(`${mainBackendUrl}/api/events/sessions/consume`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Cookie: request.headers.get("cookie") || "",
    },
    body: JSON.stringify({ ticket }),
  });

  if (!response.ok) {
    return NextResponse.redirect(new URL("/", getMainAppUrl()), 302);
  }

  const body = (await response.json()) as {
    eventSessionToken: string;
    expiresAt: string;
    returnPath?: string | null;
  };

  const redirectPath = normalizeNextPath(body.returnPath || nextPath);
  const redirectResponse = NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin), 302);
  const expiresAt = new Date(body.expiresAt);

  redirectResponse.cookies.set(EVENT_SESSION_COOKIE, body.eventSessionToken, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    domain: process.env.EVENT_SESSION_COOKIE_DOMAIN || undefined,
    path: "/",
    expires: expiresAt,
  });

  return redirectResponse;
}

function normalizeNextPath(value: string | null | undefined) {
  if (!value) {
    return "/events/diagnosis";
  }

  const parsed = new URL(value, "https://event.local");

  if (
    parsed.pathname !== "/events/diagnosis" &&
    parsed.pathname !== "/events/diagnosis/result"
  ) {
    return "/events/diagnosis";
  }

  return `${parsed.pathname}${parsed.search}`;
}

function getMainAppUrl() {
  return (
    process.env.GONGBUEONG_MAIN_URL ||
    process.env.NEXT_PUBLIC_MAIN_APP_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    "http://localhost:3000"
  );
}
