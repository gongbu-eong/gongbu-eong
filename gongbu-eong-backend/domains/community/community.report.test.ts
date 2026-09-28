import assert from "node:assert/strict";
import test from "node:test";
import { parseCommunityReport } from "./community-report";

test("other reports require a trimmed detail of at most 1,000 characters", () => {
  assert.deepEqual(parseCommunityReport({ reasonCode: "기타", reasonDetail: "  상세 사유  " }), { reasonCode: "기타", reasonDetail: "상세 사유" });
  for (const reasonDetail of [undefined, null, {}, "", "   ", "가".repeat(1001)]) {
    assert.throws(() => parseCommunityReport({ reasonCode: "기타", reasonDetail }), { name: "BadRequestError" });
  }
  assert.equal(parseCommunityReport({ reasonCode: "기타", reasonDetail: "가".repeat(1000) }).reasonDetail?.length, 1000);
});

test("switching to a predefined reason discards leftover details and invalid codes fail", () => {
  assert.deepEqual(parseCommunityReport({ reasonCode: "개인정보 노출", reasonDetail: "이전 입력" }), { reasonCode: "개인정보 노출", reasonDetail: null });
  for (const value of [null, [], {}, { reasonCode: "invalid" }]) {
    assert.throws(() => parseCommunityReport(value), { name: "BadRequestError" });
  }
});
