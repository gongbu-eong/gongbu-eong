import { apiClient } from "@/shared/api/client";

export type SignupAgreementsPayloadDto = {
  serviceTermsAgreed: boolean;
  privacyCollectionAgreed: boolean;
  ageOver14Agreed: boolean;
  marketingAgreed: boolean;
};

export type SignupAgreementsResponseDto = {
  ok: boolean;
  welcomeCreditsGranted: boolean;
  welcomeCreditsBalanceAfter?: number;
  welcomeCreditsGrantReason?: string;
};

export function completeSignupAgreements(payload: SignupAgreementsPayloadDto) {
  return apiClient<SignupAgreementsResponseDto>("/api/auth/signup/agreements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
