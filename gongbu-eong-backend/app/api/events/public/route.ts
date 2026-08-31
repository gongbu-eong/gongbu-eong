import { NextRequest } from "next/server";
import { getPublicEventListings } from "@/domains/events/events.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return jsonWithCors(
    request,
    await getPublicEventListings(),
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
