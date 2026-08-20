import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { saveAttribution } from "@/domains/analytics/analytics.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim();

  try {
    const body = await request.json();
    const user = await getSessionUser(request);
    const result = await saveAttribution({
      body,
      userId: user?.id,
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return jsonWithCors(request, { ok: true, ...result }, { status: 201 });
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Attribution write failed.",
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
