import { apiClient } from "@/shared/api/client";
import { StudyItemsResponseDto } from "./study-item.dto";

export function getStudyItems() {
  return apiClient<StudyItemsResponseDto>("/api/study-items");
}
