import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import { getDiagnosisResultDetail } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gongbu_eong_session")?.value;
  const user = token
    ? await findUserBySessionTokenHash(
        createHash("sha256").update(token).digest("hex"),
      )
    : null;

  if (!user) {
    return jsonWithCors(
      request,
      { message: "로그인이 필요합니다." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const detail = await getDiagnosisResultDetail(user.id);

  if (!detail) {
    return jsonWithCors(
      request,
      { message: "진단 결과를 찾을 수 없습니다." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return jsonWithCors(request, detail, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
