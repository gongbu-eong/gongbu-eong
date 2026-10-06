import { NextRequest } from "next/server";

// The proxy authenticates this entry point before continuing past the public guide.
export function GET(request: NextRequest) {
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/ai-tools/interview-coaching${request.nextUrl.search}`,
      "Cache-Control": "private, no-store",
    },
  });
}
