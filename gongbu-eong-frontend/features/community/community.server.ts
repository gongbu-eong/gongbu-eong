import type { CommunityListResponseDto } from "./community.dto";
import { fetchBackendJson } from "@/shared/server-data";

export async function getCommunityPostsForServer(args?: {
  q?: string;
  category?: string;
  sort?: "latest" | "popular";
  popularPeriod?: "today" | "week";
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (args?.q) params.set("q", args.q);
  if (args?.category && args.category !== "전체") {
    params.set("category", args.category);
  }
  if (args?.sort) params.set("sort", args.sort);
  if (args?.popularPeriod) params.set("popularPeriod", args.popularPeriod);
  if (args?.limit != null) params.set("limit", String(args.limit));
  if (args?.offset != null) params.set("offset", String(args.offset));

  const query = params.size ? `?${params.toString()}` : "";

  return fetchBackendJson<CommunityListResponseDto>(
    `/api/community${query}`,
  ).catch(
    () =>
      ({
        ok: true,
        items: [],
        popular: [],
        total: 0,
        limit: args?.limit ?? 20,
        offset: args?.offset ?? 0,
      }) satisfies CommunityListResponseDto,
  );
}
