import {
  getDiagnosisShareImageUrl,
  getPublicBaseUrl as getDiagnosisPublicBaseUrl,
} from "@/features/diagnosis/diagnosis-share";

export const COMMUNITY_SHARE_TITLE = "공기업 합격의 시작, 공부엉이";
export const COMMUNITY_SHARE_DESCRIPTION =
  "공기업 취준생 커뮤니티, 공시 정보, 공부·스터디, 질문·답변, 합격 후기, 면접 후기, 채용 정보를 공부엉이에서 확인하세요.";
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
