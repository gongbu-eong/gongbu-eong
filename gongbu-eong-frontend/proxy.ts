import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/my/policies" || pathname.startsWith("/my/policies/")) {
    return NextResponse.next();
  }
  if (pathname === "/jobs") {
    const view = searchParams.get("view");
    if (view !== "bookmarked" && view !== "recommended") return NextResponse.next();
  }
  if (pathname === "/calendar") {
    const scope = searchParams.get("scope") || searchParams.get("view");
    if (scope !== "mine" && scope !== "bookmarked") return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("gongbu_eong_session")?.value;

  if (sessionCookie) {
    const backendUrl =
      process.env.GONGBUEONG_BACKEND_URL ||
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:4000";

    const authenticated = await fetch(new URL("/api/auth/me", backendUrl), {
      headers: {
        Cookie: `gongbu_eong_session=${sessionCookie}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then(async (response) => {
        const body = (await response.json()) as { authenticated?: boolean };
        return response.ok && body.authenticated === true;
      })
      .catch(() => false);

    if (authenticated) {
      return NextResponse.next();
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "returnTo",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/ai-tools/coaching/:path*",
    "/ai-tools/interview-coaching/:path*",
    "/my/:path*",
    "/community/activity",
    "/community/write",
    "/community/:postId/edit",
    "/signup/agreements",
    "/jobs",
    "/calendar",
  ],
};
