import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getHomeJobs } from "@/domains/jobs/jobs.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
  const user = sessionToken
    ? await findUserBySessionTokenHash(hashValue(sessionToken))
    : null;

  return jsonWithCors(
    request,
    await getHomeJobs(user?.id),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
