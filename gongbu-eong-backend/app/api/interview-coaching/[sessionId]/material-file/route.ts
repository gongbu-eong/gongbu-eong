import { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
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
    const user = await getSessionUser(request);
    const anonymousId = readAnonymousId(request.nextUrl.searchParams.get("anonymousId"));
    const { sessionId } = await context.params;
    const file = await findInterviewMaterialFile({
      sessionId,
      userId: user?.id || null,
      anonymousId,
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
    return jsonWithCors(
      request,
      {
        ok: false,
        message:
          error instanceof Error && error.message
            ? error.message
            : "면접 자료 파일을 다운로드하지 못했습니다.",
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

function makeContentDisposition(filename: string) {
  const fallback = filename.replace(/[^\w.\-]+/g, "_") || "interview-material";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
