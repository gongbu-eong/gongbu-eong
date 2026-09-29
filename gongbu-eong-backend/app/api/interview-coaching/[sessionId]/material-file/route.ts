import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { findInterviewMaterialFile } from "@/domains/interview-coaching/interview-coaching.service";
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
    const file = await findInterviewMaterialFile({
      sessionId,
      userId: user.id,
    });

    if (!file) {
      return jsonWithCors(
        request,
        { ok: false, message: "다운로드할 면접 자료 파일을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const headers = new Headers(getCorsHeaders(request));
    headers.set("Content-Type", file.contentType);
    headers.set("Content-Length", String(file.data.length));
    headers.set("Content-Disposition", makeContentDisposition(file.filename));
    headers.set("Cache-Control", "no-store");

    return new Response(Uint8Array.from(file.data), { status: 200, headers });
  } catch (error) {
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "면접 자료 파일을 다운로드하지 못했습니다.",
      },
      { status },
    );
  }
}

function makeContentDisposition(filename: string) {
  const fallback = filename.replace(/[^\w.\-]+/g, "_") || "interview-material";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
