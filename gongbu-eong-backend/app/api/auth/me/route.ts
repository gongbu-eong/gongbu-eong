import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;

  if (!sessionToken) {
    return jsonWithCors(
      request,
      {
        ok: true,
        authenticated: false,
        user: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const user = await findUserBySessionTokenHash(hashValue(sessionToken), {
    includePendingSignup: true,
  });

  if (!user) {
    const response = NextResponse.json(
      {
        ok: true,
        authenticated: false,
        user: null,
      },
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

  return jsonWithCors(
    request,
    {
      ok: true,
      authenticated: true,
      user,
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
