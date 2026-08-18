import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { findUserFileForDownload } from "@/domains/resumes/resumes.repository";
import { downloadFromObjectStorage } from "@/lib/object-storage";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { fileId } = await context.params;

    if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
      return jsonWithCors(
        request,
        { ok: false, message: "유효하지 않은 파일입니다." },
        { status: 400 },
      );
    }

    const file = await findUserFileForDownload(user.id, fileId);
    if (!file) {
      return jsonWithCors(
        request,
        { ok: false, message: "파일을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (file.uploadStatus !== "uploaded") {
      return jsonWithCors(
        request,
        {
          ok: false,
          message: "아직 NHN Object Storage에 업로드되지 않은 파일입니다.",
          uploadStatus: file.uploadStatus,
        },
        { status: 409 },
      );
    }

    const downloaded = await downloadFromObjectStorage({
      key: file.storageObjectKey,
    });

    if (!downloaded.downloaded) {
      return jsonWithCors(
        request,
        {
          ok: false,
          message: downloaded.reason,
          storageObjectKey: file.storageObjectKey,
          publicUrl: file.publicUrl,
        },
        { status: downloaded.status || 502 },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      downloaded.contentType || file.contentType || "application/octet-stream",
    );
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`,
    );
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    if (downloaded.contentLength) {
      headers.set("Content-Length", downloaded.contentLength);
    } else if (file.sizeBytes != null) {
      headers.set("Content-Length", String(file.sizeBytes));
    }

    return new Response(downloaded.body, { status: 200, headers });
  } catch (error) {
    const status =
      error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
    const message =
      error instanceof Error ? error.message : "파일 다운로드 중 오류가 발생했습니다.";
    return jsonWithCors(request, { ok: false, message }, { status });
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
