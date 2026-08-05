import { apiClient } from "@/shared/api/client";
import {
  DiagnosisAnswerRequestDto,
  DiagnosisQuestionsResponseDto,
  DiagnosisResultDetailResponseDto,
  DiagnosisResultHistoryResponseDto,
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

export function getLatestDiagnosisResult() {
  return apiClient<{
    ok: boolean;
    result: DiagnosisResultResponseDto | null;
  }>("/api/diagnosis/results/latest");
}

export function getDiagnosisResultDetail(resultId?: string) {
  return apiClient<DiagnosisResultDetailResponseDto>(
    resultId
      ? `/api/diagnosis/results/${encodeURIComponent(resultId)}`
      : "/api/diagnosis/results/detail",
  );
}

export function getDiagnosisResultHistory(cursor?: string, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiClient<DiagnosisResultHistoryResponseDto>(
    `/api/diagnosis/results?${params.toString()}`,
  );
}

export function selectDiagnosisResult(resultId: string) {
  return apiClient<{ ok: boolean; resultId: string }>(
    `/api/diagnosis/results/${encodeURIComponent(resultId)}`,
    { method: "PATCH" },
  );
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
