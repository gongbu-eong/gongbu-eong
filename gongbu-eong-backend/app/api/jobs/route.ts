import { NextRequest } from "next/server";
import { getJobPostings } from "@/domains/jobs/jobs.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
  const categoryCode =
    request.nextUrl.searchParams.get("category") || undefined;

  return jsonWithCors(
    request,
    await getJobPostings({
      categoryCode,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
    }),
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
