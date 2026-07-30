import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import {
  addJobBookmark,
  removeJobBookmark,
} from "@/domains/jobs/jobs.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) {
    return jsonWithCors(
      request,
      { message: "로그인이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { jobId } = await params;
  if (!isUuid(jobId)) {
    return jsonWithCors(
      request,
      { message: "유효하지 않은 공고입니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return jsonWithCors(
      request,
      await addJobBookmark(user.id, jobId),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonWithCors(
      request,
      {
        message:
          error instanceof Error ? error.message : "공고를 찜하지 못했습니다.",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const user = await getSessionUser(request);
  if (!user) {
    return jsonWithCors(
      request,
      { message: "로그인이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { jobId } = await params;
  if (!isUuid(jobId)) {
    return jsonWithCors(
      request,
      { message: "유효하지 않은 공고입니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return jsonWithCors(
    request,
    await removeJobBookmark(user.id, jobId),
    { headers: { "Cache-Control": "no-store" } },
  );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

async function getSessionUser(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
  return sessionToken
    ? findUserBySessionTokenHash(hashValue(sessionToken))
    : null;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
