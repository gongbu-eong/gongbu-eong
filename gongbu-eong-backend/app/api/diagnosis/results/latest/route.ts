import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getLatestDiagnosisResult } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
  const user = sessionToken
    ? await findUserBySessionTokenHash(hashValue(sessionToken))
    : null;

  if (!user) {
    return jsonWithCors(
      request,
      { ok: false, result: null },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return jsonWithCors(
    request,
    {
      ok: true,
      result: await getLatestDiagnosisResult(user.id),
    },
    { headers: { "Cache-Control": "no-store" } },
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
