import {
  getDiagnosisShareImageUrl,
  getPublicBaseUrl as getDiagnosisPublicBaseUrl,
} from "@/features/diagnosis/diagnosis-share";

export const COMMUNITY_SHARE_TITLE = "공기업 합격의 시작, 공부엉이";
export const COMMUNITY_SHARE_DESCRIPTION =
  "강점·성향 진단부터 AI 자소서 코칭까지 공부엉이에서 준비해 보세요.";
export const COMMUNITY_SHARE_IMAGE_WIDTH = 800;
export const COMMUNITY_SHARE_IMAGE_HEIGHT = 400;

export function getPublicBaseUrl(runtimeOrigin?: string) {
  return getDiagnosisPublicBaseUrl(runtimeOrigin);
}

export function getCommunityShareImageUrl(origin = getPublicBaseUrl()) {
  return getDiagnosisShareImageUrl(origin);
}

export function getCommunityPostShareUrl(postId: string, origin = getPublicBaseUrl()) {
  return toAbsoluteUrl(`/community/${postId}`, origin);
}

function toAbsoluteUrl(value: string, origin: string) {
  try {
    return new URL(value, origin).toString();
  } catch {
    return new URL("/", getPublicBaseUrl()).toString();
  }
}
