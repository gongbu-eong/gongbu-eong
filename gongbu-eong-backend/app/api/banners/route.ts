import { NextRequest } from "next/server";
import {
  isBannerPlacement,
  listActiveBanners,
} from "@/domains/banners/banners.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const placement = request.nextUrl.searchParams.get("placement")?.trim() || "";
  if (!isBannerPlacement(placement)) {
    return jsonWithCors(
      request,
      { message: "유효한 배너 노출 위치가 필요합니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const banners = await listActiveBanners(placement);
  return jsonWithCors(
    request,
    {
      items: banners.map((banner) => ({
        ...banner,
        imageUrl: `/api/banners/${banner.id}/image?v=${encodeURIComponent(banner.updatedAt)}`,
        mobileImageUrl: banner.hasMobileImage
          ? `/api/banners/${banner.id}/image?variant=mobile&v=${encodeURIComponent(banner.updatedAt)}`
          : null,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=30" } },
  );
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
