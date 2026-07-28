import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { deleteSessionByTokenHash } from "@/domains/auth/auth.repository";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;

  if (sessionToken) {
    await deleteSessionByTokenHash(hashValue(sessionToken));
  }

  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        ...getCorsHeaders(request),
        "Cache-Control": "no-store",
      },
    },
  );

  response.cookies.delete("gongbu_eong_session");
  return response;
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
