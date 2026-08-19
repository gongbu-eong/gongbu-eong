import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { grantDiagnosisResultShareReward } from "@/domains/credits/credits.repository";
import { getDiagnosisResultDetail } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resultId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { resultId } = await context.params;
    const detail = await getDiagnosisResultDetail(user.id, resultId);

    if (!detail) {
      return jsonWithCors(
        request,
        { ok: false, message: "진단 결과를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const reward = await grantDiagnosisResultShareReward(user.id, resultId);
    return jsonWithCors(request, { ok: true, ...reward });
  } catch (error) {
    const status = error instanceof Error && error.message === "로그인이 필요합니다." ? 401 : 500;
    return jsonWithCors(
      request,
      { ok: false, message: error instanceof Error ? error.message : "공유 보상 지급에 실패했습니다." },
      { status },
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
