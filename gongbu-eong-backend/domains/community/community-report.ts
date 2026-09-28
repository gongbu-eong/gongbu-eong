export const COMMUNITY_REPORT_REASONS = [
  "스팸·홍보/도배", "욕설·비방·혐오 표현", "음란물·부적절한 콘텐츠",
  "개인정보 노출", "허위사실·사기", "게시판 성격에 맞지 않음", "기타",
] as const;

export const MAX_REPORT_DETAIL_LENGTH = 1000;

export function parseCommunityReport(value: unknown) {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const reasonCode = body.reasonCode;
  if (typeof reasonCode !== "string" || !COMMUNITY_REPORT_REASONS.includes(reasonCode as typeof COMMUNITY_REPORT_REASONS[number])) {
    throw Object.assign(new Error("신고 사유를 선택해 주세요."), { name: "BadRequestError" });
  }
  const reasonDetail = reasonCode === "기타" && typeof body.reasonDetail === "string" ? body.reasonDetail.trim() : "";
  if (reasonCode === "기타" && !reasonDetail) {
    throw Object.assign(new Error("기타 신고 사유를 입력해 주세요."), { name: "BadRequestError" });
  }
  if (reasonDetail.length > MAX_REPORT_DETAIL_LENGTH) {
    throw Object.assign(new Error("신고 상세 사유는 1,000자 이내로 입력해 주세요."), { name: "BadRequestError" });
  }
  return { reasonCode, reasonDetail: reasonDetail || null };
}
