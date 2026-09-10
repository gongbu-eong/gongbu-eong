import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import {
  claimAnonymousInterviewSessions,
  listInterviewHistory,
} from "@/domains/interview-coaching/interview-coaching.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return jsonWithCors(
        request,
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const anonymousId = readAnonymousId(request.nextUrl.searchParams.get("anonymousId"));
    if (anonymousId) {
      await claimAnonymousInterviewSessions(user.id, anonymousId);
    }

    const items = await listInterviewHistory(user.id);
    return jsonWithCors(request, { ok: true, items });
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "AI NCS 면접 코칭 기록을 불러오지 못했습니다.",
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
