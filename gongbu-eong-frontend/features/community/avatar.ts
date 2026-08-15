export function toProfileAvatarSrc(avatarKey: string | null | undefined) {
  const safeKey = avatarKey || "fox";
  return `/my/avatars/${safeKey}-profile.png?v=3`;
}
