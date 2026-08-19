export const COMMUNITY_SHARE_TITLE = "공기업 합격의 시작, 공부엉이";
export const COMMUNITY_SHARE_DESCRIPTION =
  "강점·성향 진단부터 AI 자소서 코칭까지 공부엉이에서 준비해 보세요.";
export const COMMUNITY_SHARE_IMAGE_WIDTH = 1600;
export const COMMUNITY_SHARE_IMAGE_HEIGHT = 800;

const DEFAULT_SHARE_IMAGE_PATH = "/diagnosis-result-pass-banner.png";

export function getPublicBaseUrl() {
  return (process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getCommunityShareImageUrl(origin = getPublicBaseUrl()) {
  const configuredImageUrl = process.env.NEXT_PUBLIC_KAKAO_SHARE_IMAGE_URL?.trim();

  if (configuredImageUrl) {
    return toAbsoluteUrl(configuredImageUrl, origin);
  }

  return toAbsoluteUrl(DEFAULT_SHARE_IMAGE_PATH, origin);
}

export function getCommunityPostShareUrl(postId: string, origin = getPublicBaseUrl()) {
  return toAbsoluteUrl(`/community/${postId}`, origin);
}

function toAbsoluteUrl(value: string, origin: string) {
  try {
    return new URL(value, origin).toString();
  } catch {
    return new URL(DEFAULT_SHARE_IMAGE_PATH, getPublicBaseUrl()).toString();
  }
}
