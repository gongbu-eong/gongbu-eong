import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getJobPostings } from "@/domains/jobs/jobs.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
  const categoryCode =
    request.nextUrl.searchParams.get("category") || undefined;
  const requestedView = request.nextUrl.searchParams.get("view");
  const value = (key: string) =>
    request.nextUrl.searchParams.get(key)?.trim() || undefined;
  const view =
    requestedView === "closing" ||
    requestedView === "recommended" ||
    requestedView === "bookmarked"
      ? requestedView
      : "all";
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
  const user = sessionToken
    ? await findUserBySessionTokenHash(hashValue(sessionToken))
    : null;

  return jsonWithCors(
    request,
    await getJobPostings({
      categoryCode,
      limit: Number.isFinite(limit) ? limit : 20,
      offset: Number.isFinite(offset) ? offset : 0,
      view,
      userId: user?.id,
      diagnosisResultId: value("resultId"),
      query: value("query"),
      ncsCategory: value("ncs"),
      region: value("region"),
      employmentType: value("employmentType"),
      educationRequirement: value("education"),
      careerRequirement: value("career"),
      startDate: value("startDate"),
      endDate: value("endDate"),
      monthlyRegularOnly: value("scope") === "monthly-regular",
      sort:
        value("sort") === "latest" || value("sort") === "views"
          ? (value("sort") as "latest" | "views")
          : undefined,
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
