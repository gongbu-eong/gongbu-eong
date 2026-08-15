import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import {
  findUserProfile,
  PROFILE_AGE_GROUPS,
  PROFILE_AVATAR_KEYS,
  PROFILE_BACKGROUND_COLORS,
  PROFILE_GENDERS,
  updateUserProfile,
  type ProfileAgeGroup,
  type ProfileAvatarKey,
  type ProfileGender,
} from "@/domains/profile/profile.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const profile = await findUserProfile(user.id);

    if (!profile) {
      return jsonWithCors(request, { ok: false, message: "프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    return jsonWithCors(request, { ok: true, profile });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const payload = await request.json().catch(() => null);
    const input = readProfilePayload(payload);
    const profile = await updateUserProfile(user.id, input);

    if (!profile) {
      return jsonWithCors(request, { ok: false, message: "프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    return jsonWithCors(request, { ok: true, profile });
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

function readProfilePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw badRequest("프로필 정보를 확인해 주세요.");
  }

  const value = payload as Record<string, unknown>;
  const communityNickname = readTrimmedString(value.communityNickname);
  const profileStatusMessage = readTrimmedString(value.profileStatusMessage);
  const profileAvatarKey = readEnum(value.profileAvatarKey, PROFILE_AVATAR_KEYS, "아바타를 선택해 주세요.");
  const profileBackgroundColor = readEnum(value.profileBackgroundColor, PROFILE_BACKGROUND_COLORS, "프로필 배경색을 선택해 주세요.");
  const gender = readNullableEnum(value.gender, PROFILE_GENDERS, "성별을 확인해 주세요.");
  const ageGroup = readNullableEnum(value.ageGroup, PROFILE_AGE_GROUPS, "연령대를 확인해 주세요.");

  if (!communityNickname) {
    throw badRequest("닉네임을 입력해 주세요.");
  }

  if (communityNickname.length > 12) {
    throw badRequest("닉네임은 12자 이하로 입력해 주세요.");
  }

  if (profileStatusMessage && profileStatusMessage.length > 30) {
    throw badRequest("상태 메시지는 30자 이하로 입력해 주세요.");
  }

  return {
    communityNickname,
    profileStatusMessage: profileStatusMessage || null,
    profileAvatarKey: profileAvatarKey as ProfileAvatarKey,
    profileBackgroundColor,
    gender: gender as ProfileGender | null,
    ageGroup: ageGroup as ProfileAgeGroup | null,
  };
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  message: string,
) {
  if (typeof value === "string" && options.includes(value)) {
    return value;
  }

  throw badRequest(message);
}

function readNullableEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  message: string,
) {
  if (value == null || value === "") return null;
  return readEnum(value, options, message);
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
  const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
  return jsonWithCors(request, { ok: false, message }, { status });
}
