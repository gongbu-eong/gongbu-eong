import { apiClient } from "@/shared/api/client";
import type {
  CurrentUserResponseDto,
  HomeJobsResponseDto,
  JobBookmarkResponseDto,
  JobListView,
  JobPostingListResponseDto,
  JobPostingDetailDto,
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
  view?: JobListView;
  query?: string;
  ncs?: string;
  region?: string;
  employmentType?: string;
  education?: string;
  career?: string;
  startDate?: string;
  endDate?: string;
  sort?: "closing" | "latest" | "views";
  resultId?: string;
}) {
  const searchParams = new URLSearchParams();

  if (args?.category) searchParams.set("category", args.category);
  if (args?.limit != null) searchParams.set("limit", String(args.limit));
  if (args?.offset != null) searchParams.set("offset", String(args.offset));
  if (args?.view && args.view !== "all") searchParams.set("view", args.view);
  if (args?.query) searchParams.set("query", args.query);
  if (args?.ncs) searchParams.set("ncs", args.ncs);
  if (args?.region) searchParams.set("region", args.region);
  if (args?.employmentType) searchParams.set("employmentType", args.employmentType);
  if (args?.education) searchParams.set("education", args.education);
  if (args?.career) searchParams.set("career", args.career);
  if (args?.startDate) searchParams.set("startDate", args.startDate);
  if (args?.endDate) searchParams.set("endDate", args.endDate);
  if (args?.sort) searchParams.set("sort", args.sort);
  if (args?.resultId) searchParams.set("resultId", args.resultId);

  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  return apiClient<JobPostingListResponseDto>(`/api/jobs${query}`);
}

export function getJobPosting(jobId: string) {
  return apiClient<JobPostingDetailDto>(`/api/jobs/${jobId}`);
}

export function setJobBookmark(jobId: string, bookmarked: boolean) {
  return apiClient<JobBookmarkResponseDto>(`/api/jobs/${jobId}/bookmark`, {
    method: bookmarked ? "POST" : "DELETE",
  });
}
