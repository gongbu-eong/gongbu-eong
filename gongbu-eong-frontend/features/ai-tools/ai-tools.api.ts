import { apiClient } from "@/shared/api/client";
import type { AiToolEventsResponseDto } from "./ai-tools.dto";

export function getAiToolEvents() {
  return apiClient<AiToolEventsResponseDto>("/api/events/public");
}
