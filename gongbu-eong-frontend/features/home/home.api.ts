import { apiClient } from "@/shared/api/client";
import type {
  CurrentUserResponseDto,
  HomeJobsResponseDto,
  JobPostingListResponseDto,
} from "./home.dto";

export function getCurrentUser() {
  return apiClient<CurrentUserResponseDto>("/api/auth/me");
}

export function logoutCurrentUser() {
  return apiClient<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export function getHomeJobs() {
  return apiClient<HomeJobsResponseDto>("/api/jobs/home");
}

export function getJobPostings(args?: {
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();

  if (args?.category) searchParams.set("category", args.category);
  if (args?.limit != null) searchParams.set("limit", String(args.limit));
  if (args?.offset != null) searchParams.set("offset", String(args.offset));

  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  return apiClient<JobPostingListResponseDto>(`/api/jobs${query}`);
}
