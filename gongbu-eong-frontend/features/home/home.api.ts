import { apiClient } from "@/shared/api/client";
import type { CurrentUserResponseDto } from "./home.dto";

export function getCurrentUser() {
  return apiClient<CurrentUserResponseDto>("/api/auth/me");
}

export function logoutCurrentUser() {
  return apiClient<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}
