import { apiClient } from "@/shared/api/client";
import { HealthResponseDto } from "./health.dto";

export function getBackendHealth() {
  return apiClient<HealthResponseDto>("/api/health");
}
