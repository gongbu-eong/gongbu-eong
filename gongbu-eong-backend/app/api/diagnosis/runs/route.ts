import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { submitDiagnosis } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim();
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
  const user = sessionToken
    ? await findUserBySessionTokenHash(hashValue(sessionToken))
    : null;

  try {
    return jsonWithCors(
      request,
      await submitDiagnosis({
        body,
        userId: user?.id,
        ipAddress,
        userAgent: request.headers.get("user-agent") || undefined,
        referer: request.headers.get("referer") || undefined,
      }),
      { status: 201 },
    );
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Diagnosis submit failed.",
      },
      { status: 400 },
    );
  }
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
