import { NextRequest } from "next/server";
import { requireSignupAgreementSessionUser } from "@/domains/auth/session";
import { completeSignupAgreements } from "@/domains/auth/signup-agreements.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSignupAgreementSessionUser(request);
    const payload = await request.json().catch(() => null);
    const input = readPayload(payload);
    const forwardedFor = request.headers.get("x-forwarded-for");
    const result = await completeSignupAgreements(user.id, {
      ...input,
      ipAddress: forwardedFor?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!result) {
      return jsonWithCors(
        request,
        { ok: false, message: "가입 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return jsonWithCors(request, { ok: true, ...result });
  } catch (error) {
    const status =
      error instanceof Error && error.name === "UnauthorizedError"
        ? 401
        : error instanceof Error && error.name === "BadRequestError"
          ? 400
          : 500;
    const message =
      error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";

    return jsonWithCors(request, { ok: false, message }, { status });
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function readPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw badRequest("약관 동의 정보를 확인해 주세요.");
  }

  const value = payload as Record<string, unknown>;
  const serviceTermsAgreed = value.serviceTermsAgreed === true;
  const privacyCollectionAgreed = value.privacyCollectionAgreed === true;
  const ageOver14Agreed = value.ageOver14Agreed === true;
  const marketingAgreed = value.marketingAgreed === true;

  if (!serviceTermsAgreed || !privacyCollectionAgreed || !ageOver14Agreed) {
    throw badRequest("필수 약관에 모두 동의해야 가입할 수 있습니다.");
  }

  return {
    serviceTermsAgreed,
    privacyCollectionAgreed,
    ageOver14Agreed,
    marketingAgreed,
  };
}

function badRequest(message: string) {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
}
