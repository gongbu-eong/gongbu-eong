import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getCalendarJobPostings } from "@/domains/jobs/jobs.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startDate =
    request.nextUrl.searchParams.get("startDate")?.trim() ||
    request.nextUrl.searchParams.get("from")?.trim();
  const endDate =
    request.nextUrl.searchParams.get("endDate")?.trim() ||
    request.nextUrl.searchParams.get("to")?.trim();
  const requestedView = request.nextUrl.searchParams.get("view");
  const view = requestedView === "bookmarked" ? "bookmarked" : "all";

  if (!startDate || !endDate) {
    return jsonWithCors(
      request,
      { message: "startDate와 endDate가 필요합니다." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
  const user = sessionToken
    ? await findUserBySessionTokenHash(hashValue(sessionToken))
    : null;

  return jsonWithCors(
    request,
    await getCalendarJobPostings({
      startDate,
      endDate,
      userId: user?.id,
      view,
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
