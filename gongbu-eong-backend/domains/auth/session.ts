import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "./auth.repository";

export async function getSessionUser(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;

  if (!sessionToken) {
    return null;
  }

  return findUserBySessionTokenHash(hashValue(sessionToken));
}

export async function requireSessionUser(request: NextRequest) {
  const user = await getSessionUser(request);

  if (!user) {
    const error = new Error("로그인이 필요합니다.");
    error.name = "UnauthorizedError";
    throw error;
  }

  return user;
}

export async function requireSignupAgreementSessionUser(request: NextRequest) {
  const sessionToken = request.cookies.get("gongbu_eong_session")?.value;

  if (!sessionToken) {
    const error = new Error("로그인이 필요합니다.");
    error.name = "UnauthorizedError";
    throw error;
  }

  const user = await findUserBySessionTokenHash(hashValue(sessionToken), {
    includePendingSignup: true,
  });

  if (!user) {
    const error = new Error("로그인이 필요합니다.");
    error.name = "UnauthorizedError";
    throw error;
  }

  return user;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
