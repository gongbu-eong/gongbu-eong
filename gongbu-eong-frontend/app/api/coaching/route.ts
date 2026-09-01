import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  try {
    const response = await fetch(`${backendUrl}/api/coaching`, {
      method: "POST",
      headers: { cookie: request.headers.get("cookie") || "" },
      body: await request.formData(),
      cache: "no-store",
    });
    const contentType = response.headers.get("Content-Type") || "";
    const body = await response.arrayBuffer();

    if (!contentType.toLowerCase().includes("application/json")) {
      const preview = new TextDecoder().decode(body).slice(0, 500);
      console.error("[Coaching proxy] backend returned non-json response", {
        status: response.status,
        contentType,
        preview,
      });
      return Response.json(
        {
          ok: false,
          message:
            "AI 자소서 코칭 처리 중 서버 응답 오류가 발생했습니다. 진단권이 차감된 경우 자동 환불됩니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: response.ok ? 502 : response.status },
      );
    }

    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error("[Coaching proxy] request failed", error);
    return Response.json(
      {
        ok: false,
        message:
          "AI 자소서 코칭 서버에 연결하지 못했습니다. 진단권은 차감되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 502 },
    );
  }
}
