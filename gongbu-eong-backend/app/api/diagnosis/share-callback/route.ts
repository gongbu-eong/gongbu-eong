import { NextRequest } from "next/server";
import { grantDiagnosisResultShareReward } from "@/domains/credits/credits.repository";
import { getDiagnosisResultDetail } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

const CALLBACK_ACTION = "diagnosis_result_share";

export async function GET(request: NextRequest) {
  return handleKakaoShareCallback(request);
}

export async function POST(request: NextRequest) {
  return handleKakaoShareCallback(request);
}

async function handleKakaoShareCallback(request: NextRequest) {
  if (!isAuthorizedKakaoCallback(request)) {
    return jsonWithCors(request, { ok: false, message: "인증되지 않은 공유 콜백입니다." }, { status: 401 });
  }

  try {
    const params = await readCallbackParams(request);
    const action = params.get("gb_action") || "";
    const userId = params.get("gb_user_id") || "";
    const resultId = params.get("gb_result_id") || "";

    if (action !== CALLBACK_ACTION || !isUuid(userId) || !isUuid(resultId)) {
      return jsonWithCors(request, { ok: false, message: "공유 콜백 값이 올바르지 않습니다." }, { status: 400 });
    }

    const detail = await getDiagnosisResultDetail(userId, resultId);
    if (!detail) {
      return jsonWithCors(request, { ok: false, message: "진단 결과를 찾을 수 없습니다." }, { status: 404 });
    }

    const reward = await grantDiagnosisResultShareReward(userId, resultId);
    return jsonWithCors(request, { ok: true, ...reward });
  } catch (error) {
    console.error("[Diagnosis] Kakao share callback failed", error);
    return jsonWithCors(request, { ok: false, message: "공유 보상 지급에 실패했습니다." }, { status: 500 });
  }
}

async function readCallbackParams(request: NextRequest) {
  const params = new URLSearchParams(request.nextUrl.searchParams);

  if (request.method !== "POST") {
    return params;
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object") {
      for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          params.set(key, String(value));
        }
      }
    }
    return params;
  }

  const text = await request.text().catch(() => "");
  if (text) {
    const bodyParams = new URLSearchParams(text);
    bodyParams.forEach((value, key) => params.set(key, value));
  }
  return params;
}

function isAuthorizedKakaoCallback(request: NextRequest) {
  const adminKey = process.env.KAKAO_ADMIN_KEY?.trim();

  if (!adminKey) {
    console.warn("[Diagnosis] KAKAO_ADMIN_KEY is not configured; Kakao share callback auth check was skipped.");
    return true;
  }

  return request.headers.get("authorization") === `KakaoAK ${adminKey}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
