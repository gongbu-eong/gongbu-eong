import { db } from "@/lib/db";

export const PROFILE_AVATAR_KEYS = [
  "fox",
  "lion",
  "cat",
  "penguin",
  "chick",
  "monkey",
  "cow",
  "bear",
  "chicken",
  "mouse",
] as const;

export const PROFILE_BACKGROUND_COLORS = [
  "#c6d5ff",
  "#b9c9ff",
  "#d1c2ff",
  "#f5bfd9",
  "#c7ecdc",
  "#f5d2b0",
  "#c9d6d8",
  "#c4c6ca",
] as const;

export const PROFILE_GENDERS = ["female", "male"] as const;
export const PROFILE_AGE_GROUPS = [
  "teens",
  "early_20s",
  "late_20s",
  "early_30s",
  "late_30s",
  "over_40",
] as const;

export type ProfileAvatarKey = (typeof PROFILE_AVATAR_KEYS)[number];
export type ProfileGender = (typeof PROFILE_GENDERS)[number];
export type ProfileAgeGroup = (typeof PROFILE_AGE_GROUPS)[number];

export type UserProfile = {
  id: string;
  email: string | null;
  nickname: string | null;
  displayName: string | null;
  communityNickname: string | null;
  profileStatusMessage: string | null;
  profileAvatarKey: ProfileAvatarKey;
  profileBackgroundColor: string;
  gender: ProfileGender | null;
  ageGroup: ProfileAgeGroup | null;
};

type UserProfileRow = {
  id: string;
  email: string | null;
  nickname: string | null;
  display_name: string | null;
  community_nickname: string | null;
  profile_status_message: string | null;
  profile_avatar_key: ProfileAvatarKey | null;
  profile_background_color: string | null;
  gender: ProfileGender | null;
  age_group: ProfileAgeGroup | null;
};

export type UpdateUserProfileInput = {
  email: string;
  communityNickname: string;
  profileStatusMessage: string | null;
  profileAvatarKey: ProfileAvatarKey;
  profileBackgroundColor: string;
  gender: ProfileGender | null;
  ageGroup: ProfileAgeGroup | null;
};

export async function findUserProfile(userId: string) {
  const result = await db.query<UserProfileRow>(
    `
      SELECT
        id,
        email,
        nickname,
        display_name,
        community_nickname,
        profile_status_message,
        profile_avatar_key,
        profile_background_color,
        gender,
        age_group
      FROM public.users
      WHERE id = $1
        AND status = 'active'
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? toUserProfile(result.rows[0]) : null;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
) {
  const duplicatedEmail = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE email = $1::citext
          AND id <> $2
      ) AS exists
    `,
    [input.email, userId],
  );

  if (duplicatedEmail.rows[0]?.exists) {
    const error = new Error("이미 사용 중인 이메일입니다.");
    error.name = "DuplicateEmailError";
    throw error;
  }

  const duplicated = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE community_nickname = $1
          AND id <> $2
          AND status = 'active'
      ) AS exists
    `,
    [input.communityNickname, userId],
  );

  if (duplicated.rows[0]?.exists) {
    const error = new Error("이미 사용 중인 닉네임입니다.");
    error.name = "DuplicateNicknameError";
    throw error;
  }

  const result = await db.query<UserProfileRow>(
    `
      UPDATE public.users
      SET
        email = $2::citext,
        community_nickname = $3,
        profile_status_message = $4,
        profile_avatar_key = $5,
        profile_background_color = $6,
        gender = $7,
        age_group = $8,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'active'
      RETURNING
        id,
        email,
        nickname,
        display_name,
        community_nickname,
        profile_status_message,
        profile_avatar_key,
        profile_background_color,
        gender,
        age_group
    `,
    [
      userId,
      input.email,
      input.communityNickname,
      input.profileStatusMessage,
      input.profileAvatarKey,
      input.profileBackgroundColor,
      input.gender,
      input.ageGroup,
    ],
  );

  return result.rows[0] ? toUserProfile(result.rows[0]) : null;
}

function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    displayName: row.display_name,
    communityNickname: row.community_nickname,
    profileStatusMessage: row.profile_status_message,
    profileAvatarKey: row.profile_avatar_key || "fox",
    profileBackgroundColor: row.profile_background_color || "#c4c6ca",
    gender: row.gender,
    ageGroup: row.age_group,
  };
}
