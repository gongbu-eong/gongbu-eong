import { apiClient } from "@/shared/api/client";
import { TestRowsResponseDto } from "./test.dto";

export function getTestRows() {
  return apiClient<TestRowsResponseDto>("/api/test");
}
