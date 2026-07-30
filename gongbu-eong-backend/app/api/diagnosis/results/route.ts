import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getDiagnosisResultHistory } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    return jsonWithCors(
      request,
      { message: "로그인이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 10);

  return jsonWithCors(
    request,
    await getDiagnosisResultHistory({
      userId: user.id,
      cursor: request.nextUrl.searchParams.get("cursor") || undefined,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 10,
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get("gongbu_eong_session")?.value;
  return token
    ? findUserBySessionTokenHash(createHash("sha256").update(token).digest("hex"))
    : null;
}
