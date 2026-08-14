import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ resultId: string }> }) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const { resultId } = await context.params;
  const response = await fetch(`${backendUrl}/api/coaching/history/${encodeURIComponent(resultId)}`, {
    headers: { cookie: request.headers.get("cookie") || "" },
    cache: "no-store",
  });
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
  });
}
