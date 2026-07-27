import { NextRequest } from "next/server";
import { createAccessLog } from "@/domains/access/access.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim();

  try {
    await createAccessLog({
      body,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return jsonWithCors(request, { ok: true }, { status: 201 });
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Access log write failed.",
      },
      { status: 400 },
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
