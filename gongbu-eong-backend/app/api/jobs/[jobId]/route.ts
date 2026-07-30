import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getJobPostingDetail } from "@/domains/jobs/jobs.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
    return jsonWithCors(request, { message: "유효하지 않은 공고입니다." }, { status: 400 });
  }

  const token = request.cookies.get("gongbu_eong_session")?.value;
  const user = token
    ? await findUserBySessionTokenHash(
        createHash("sha256").update(token).digest("hex"),
      )
    : null;
  const detail = await getJobPostingDetail(jobId, user?.id);

  return detail
    ? jsonWithCors(request, detail, {
        headers: { "Cache-Control": "private, no-store" },
      })
    : jsonWithCors(
        request,
        { message: "공고를 찾을 수 없습니다." },
        { status: 404 },
      );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
