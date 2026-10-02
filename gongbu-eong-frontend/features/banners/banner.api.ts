import { apiClient } from "@/shared/api/client";
import type {
  ActiveBannerListResponseDto,
  BannerPlacement,
} from "./banner.dto";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function getActiveBanners(placement: BannerPlacement) {
  const response = await apiClient<ActiveBannerListResponseDto>(
    `/api/banners?placement=${encodeURIComponent(placement)}`,
  );
  return {
    items: response.items.map((banner) => ({
      ...banner,
      imageUrl: new URL(banner.imageUrl, backendUrl).toString(),
    })),
  };
}

export function resolveBannerTargetUrl(
  targetUrl: string,
  context: { jobId?: string } = {},
) {
  return targetUrl.replaceAll(
    "{jobId}",
    context.jobId ? encodeURIComponent(context.jobId) : "",
  );
}
