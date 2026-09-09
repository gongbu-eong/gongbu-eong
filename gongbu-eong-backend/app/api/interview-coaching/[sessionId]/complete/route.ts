import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { completeInterviewCoaching } from "@/domains/interview-coaching/interview-coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await getSessionUser(request);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const anonymousId = readAnonymousId(body.anonymousId);
    const { sessionId } = await context.params;

    if (!user && !anonymousId) {
      return jsonWithCors(
        request,
        { ok: false, message: "익명 사용자 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요." },
        { status: 400 },
      );
    }

    const session = await completeInterviewCoaching({
      sessionId,
      userId: user?.id || null,
      anonymousId: user ? null : anonymousId,
    });

    return jsonWithCors(request, { ok: true, session });
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "면접 결과 생성에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}

function readAnonymousId(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}
