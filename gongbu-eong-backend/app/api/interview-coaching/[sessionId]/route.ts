import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { findInterviewSessionForViewer } from "@/domains/interview-coaching/interview-coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getSessionUser(request);
    const anonymousId = readAnonymousId(request.nextUrl.searchParams.get("anonymousId"));
    const { sessionId } = await context.params;
    const session = await findInterviewSessionForViewer({
      sessionId,
      userId: user?.id || null,
      anonymousId,
    });

    if (!session) {
      return jsonWithCors(
        request,
        { ok: false, message: "AI NCS 면접 코칭 결과를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    return jsonWithCors(request, { ok: true, session });
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "AI NCS 면접 코칭 결과를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

function readAnonymousId(value: string | null) {
  if (!value) return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}
