import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
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
    const user = await requireSessionUser(request);
    const { sessionId } = await context.params;
    const session = await findInterviewSessionForViewer({
      sessionId,
      userId: user.id,
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
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "AI NCS 면접 코칭 결과를 불러오지 못했습니다.",
      },
      { status },
    );
  }
}
