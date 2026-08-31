import { NextRequest } from "next/server";
import { EventError, validateEventSessionToken } from "@/domains/events/events.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      eventNo?: string;
      eventSessionToken?: string;
    };

    if (!body.eventNo || !body.eventSessionToken) {
      return jsonWithCors(
        request,
        { message: "이벤트 번호와 세션 토큰이 필요합니다." },
        { status: 400 },
      );
    }

    const result = await validateEventSessionToken({
      eventNo: body.eventNo,
      eventSessionToken: body.eventSessionToken,
    });

    return jsonWithCors(request, result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof EventError) {
      return jsonWithCors(
        request,
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("Failed to validate event session", error);

    return jsonWithCors(
      request,
      { message: "이벤트 세션 확인 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
