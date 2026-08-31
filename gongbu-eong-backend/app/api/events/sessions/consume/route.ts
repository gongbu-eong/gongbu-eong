import { NextRequest } from "next/server";
import { consumeEventTicket, EventError } from "@/domains/events/events.service";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { ticket?: string };

    if (!body.ticket) {
      return jsonWithCors(
        request,
        { message: "이벤트 진입 티켓이 필요합니다." },
        { status: 400 },
      );
    }

    const result = await consumeEventTicket({
      request,
      ticket: body.ticket,
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

    console.error("Failed to consume event ticket", error);

    return jsonWithCors(
      request,
      { message: "이벤트 진입 처리 중 오류가 발생했습니다." },
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
