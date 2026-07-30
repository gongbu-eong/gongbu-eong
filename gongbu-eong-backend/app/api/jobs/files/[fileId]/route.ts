import { NextRequest } from "next/server";
import { getJobPostingFile } from "@/domains/jobs/jobs.service";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    return Response.json(
      { message: "유효하지 않은 첨부파일입니다." },
      { status: 400 },
    );
  }

  const file = await getJobPostingFile(fileId);
  if (!file) {
    return Response.json(
      { message: "첨부파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const source = new URL(file.fileUrl);
  if (
    source.protocol !== "https:" ||
    !(
      source.hostname === "alio.go.kr" ||
      source.hostname.endsWith(".alio.go.kr")
    )
  ) {
    return Response.json(
      { message: "허용되지 않은 첨부파일 주소입니다." },
      { status: 400 },
    );
  }

  const upstream = await fetch(source, {
    redirect: "follow",
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { message: "첨부파일을 내려받지 못했습니다." },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "application/octet-stream",
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
  );
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
