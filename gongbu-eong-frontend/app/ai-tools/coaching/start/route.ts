import { NextRequest, NextResponse } from "next/server";

// The proxy authenticates this entry point before continuing past the public guide.
export function GET(request: NextRequest) {
  const coachingUrl = request.nextUrl.clone();
  coachingUrl.pathname = "/ai-tools/coaching";

  const response = NextResponse.redirect(coachingUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
