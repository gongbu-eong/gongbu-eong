import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { decryptOAuthToken } from "@/domains/auth/oauth-token-crypto";
import {
  findOAuthAccountsForWithdrawal,
  WITHDRAWAL_REASON_CODES,
  withdrawUserAccount,
  type ExternalUnlinkResult,
  type WithdrawalOAuthAccount,
  type WithdrawalReasonCode,
} from "@/domains/auth/withdrawal.repository";
import { getCorsHeaders, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const payload = await request.json().catch(() => null);
    const input = readWithdrawalPayload(payload);
    const oauthAccounts = await findOAuthAccountsForWithdrawal(user.id);
    const externalUnlinkResults = await Promise.all(
      oauthAccounts.map((account) => unlinkExternalOAuth(account)),
    );
    const sessionToken = request.cookies.get("gongbu_eong_session")?.value;
    const forwardedFor = request.headers.get("x-forwarded-for");

    const withdrawal = await withdrawUserAccount({
      userId: user.id,
      sessionTokenHash: sessionToken ? hashValue(sessionToken) : undefined,
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      noticeAgreed: input.noticeAgreed,
      oauthAccounts,
      externalUnlinkResults,
      ipAddress: forwardedFor?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const response = NextResponse.json(
      {
        ok: true,
        withdrawalRequestId: withdrawal.withdrawalRequestId,
        privateDataPurgeAfter: withdrawal.privateDataPurgeAfter,
        externalUnlinkResults,
      },
      {
        headers: {
          ...getCorsHeaders(request),
          "Cache-Control": "no-store",
        },
      },
    );
    response.cookies.delete("gongbu_eong_session");
    return response;
  } catch (error) {
    return handleError(request, error);
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function readWithdrawalPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw badRequest("탈퇴 정보를 확인해 주세요.");
  }

  const value = payload as Record<string, unknown>;
  const noticeAgreed = value.noticeAgreed === true;
  const reasonCode = value.reasonCode;
  const reasonDetail = readTrimmedString(value.reasonDetail);

  if (!noticeAgreed) {
    throw badRequest("탈퇴 안내 사항에 동의해 주세요.");
  }

  if (
    typeof reasonCode !== "string" ||
    !WITHDRAWAL_REASON_CODES.includes(reasonCode as WithdrawalReasonCode)
  ) {
    throw badRequest("탈퇴 사유를 선택해 주세요.");
  }

  if (reasonCode === "other" && !reasonDetail) {
    throw badRequest("기타 사유를 입력해 주세요.");
  }

  if (reasonDetail.length > 1000) {
    throw badRequest("기타 사유는 1000자 이하로 입력해 주세요.");
  }

  return {
    noticeAgreed,
    reasonCode: reasonCode as WithdrawalReasonCode,
    reasonDetail: reasonDetail || null,
  };
}

async function unlinkExternalOAuth(
  account: WithdrawalOAuthAccount,
): Promise<ExternalUnlinkResult> {
  if (account.provider === "kakao") {
    return unlinkKakao(account.providerUserId);
  }

  return revokeNaverToken(account);
}

async function unlinkKakao(providerUserId: string): Promise<ExternalUnlinkResult> {
  if (!process.env.KAKAO_ADMIN_KEY) {
    return {
      provider: "kakao",
      status: "skipped",
      message: "KAKAO_ADMIN_KEY is not configured.",
    };
  }

  const response = await fetch("https://kapi.kakao.com/v1/user/unlink", {
    method: "POST",
    headers: {
      Authorization: `KakaoAK ${process.env.KAKAO_ADMIN_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      target_id_type: "user_id",
      target_id: providerUserId,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      provider: "kakao",
      status: "failed",
      message: body || `Kakao unlink failed: ${response.status}`,
    };
  }

  return { provider: "kakao", status: "succeeded" };
}

async function revokeNaverToken(
  account: WithdrawalOAuthAccount,
): Promise<ExternalUnlinkResult> {
  const token =
    decryptOAuthToken(account.refreshTokenEncrypted) ||
    decryptOAuthToken(account.accessTokenEncrypted);

  if (!token) {
    return {
      provider: "naver",
      status: "skipped",
      message: "Stored Naver token is not available for revoke.",
    };
  }

  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return {
      provider: "naver",
      status: "skipped",
      message: "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not configured.",
    };
  }

  const response = await fetch("https://nid.naver.com/oauth2.0/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.NAVER_CLIENT_ID,
      client_secret: process.env.NAVER_CLIENT_SECRET,
      token,
      token_type_hint: account.refreshTokenEncrypted
        ? "refresh_token"
        : "access_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      provider: "naver",
      status: "failed",
      message: body || `Naver token revoke failed: ${response.status}`,
    };
  }

  return { provider: "naver", status: "succeeded" };
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function badRequest(message: string) {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
}

function handleError(request: NextRequest, error: unknown) {
  const status =
    error instanceof Error && error.name === "UnauthorizedError"
      ? 401
      : error instanceof Error && error.name === "BadRequestError"
        ? 400
        : 500;
  const message =
    error instanceof Error
      ? error.message
      : "회원 탈퇴 처리 중 오류가 발생했습니다.";
  return jsonWithCors(request, { ok: false, message }, { status });
}
