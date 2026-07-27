import { apiClient } from "@/shared/api/client";
import {
  DiagnosisAnswerRequestDto,
  DiagnosisQuestionsResponseDto,
  DiagnosisResultResponseDto,
  DiagnosisStatsResponseDto,
} from "./diagnosis.dto";
import { getAnonymousId } from "@/shared/session/anonymous-id";

export function getDiagnosisQuestions() {
  return apiClient<DiagnosisQuestionsResponseDto>("/api/diagnosis/questions");
}

export function getDiagnosisStats() {
  return apiClient<DiagnosisStatsResponseDto>("/api/diagnosis/stats");
}

export function submitDiagnosis(answers: DiagnosisAnswerRequestDto[]) {
  return apiClient<DiagnosisResultResponseDto>("/api/diagnosis/runs", {
    method: "POST",
    body: JSON.stringify({
      anonymousId: getAnonymousId(),
      entrySource: "diagnosis",
      answers,
    }),
  });
}
