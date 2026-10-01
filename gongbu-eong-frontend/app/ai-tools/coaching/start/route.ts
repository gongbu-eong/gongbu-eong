import { NextRequest } from "next/server";

// The proxy authenticates this entry point before continuing past the public guide.
export function GET(request: NextRequest) {
  // Keep this redirect relative. Behind nginx, request.nextUrl can contain the
  // internal Next.js host (localhost:3000) combined with the public HTTPS scheme.
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/ai-tools/coaching${request.nextUrl.search}`,
      "Cache-Control": "private, no-store",
    },
  });
}
