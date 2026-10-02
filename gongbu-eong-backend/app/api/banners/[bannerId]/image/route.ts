import { NextRequest } from "next/server";
import { getActiveBannerImage } from "@/domains/banners/banners.repository";
import { getCorsHeaders } from "@/lib/cors";

export const runtime = "nodejs";

type Context = { params: Promise<{ bannerId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  const { bannerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(bannerId)) {
    return new Response("Invalid banner", { status: 400, headers: getCorsHeaders(request) });
  }

  const variant = request.nextUrl.searchParams.get("variant") === "mobile" ? "mobile" : "desktop";
  const image = await getActiveBannerImage(bannerId, variant);
  if (!image) {
    return new Response("Not found", { status: 404, headers: getCorsHeaders(request) });
  }

  return new Response(new Uint8Array(image.image_data), {
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": image.image_mime_type,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(image.image_filename || "banner")}`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
