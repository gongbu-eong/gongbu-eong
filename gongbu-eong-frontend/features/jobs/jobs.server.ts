import type {
  JobListView,
  JobPostingListResponseDto,
} from "@/features/home/home.dto";
import { fetchBackendJson } from "@/shared/server-data";

export async function getJobPostingsForServer(args?: {
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
  scope?: "monthly-regular";
}) {
  const searchParams = new URLSearchParams();

  if (args?.category) searchParams.set("category", args.category);
  if (args?.limit != null) searchParams.set("limit", String(args.limit));
  if (args?.offset != null) searchParams.set("offset", String(args.offset));
  if (args?.view && args.view !== "all") searchParams.set("view", args.view);
  if (args?.query) searchParams.set("query", args.query);
  if (args?.ncs) searchParams.set("ncs", args.ncs);
  if (args?.region) searchParams.set("region", args.region);
  if (args?.employmentType) {
    searchParams.set("employmentType", args.employmentType);
  }
  if (args?.education) searchParams.set("education", args.education);
  if (args?.career) searchParams.set("career", args.career);
  if (args?.startDate) searchParams.set("startDate", args.startDate);
  if (args?.endDate) searchParams.set("endDate", args.endDate);
  if (args?.sort) searchParams.set("sort", args.sort);
  if (args?.resultId) searchParams.set("resultId", args.resultId);
  if (args?.scope) searchParams.set("scope", args.scope);

  const query = searchParams.size ? `?${searchParams.toString()}` : "";

  return fetchBackendJson<JobPostingListResponseDto>(`/api/jobs${query}`).catch(
    () =>
      ({
        items: [],
        total: 0,
        limit: args?.limit ?? 20,
        offset: args?.offset ?? 0,
        recommendationTypeName: null,
      }) satisfies JobPostingListResponseDto,
  );
}
