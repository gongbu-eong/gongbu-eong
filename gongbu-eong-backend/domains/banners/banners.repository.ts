import { query } from "@/lib/db";

export const BANNER_PLACEMENTS = [
  "home_main",
  "ai_tools_main",
  "resume_coaching",
  "interview_coaching",
  "job_detail",
] as const;

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

type ActiveBannerRow = {
  id: string;
  placement: BannerPlacement;
  name: string;
  target_url: string | null;
  sort_order: number;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  has_mobile_image: boolean;
  updated_at: Date | string;
};

export async function listActiveBanners(placement: BannerPlacement) {
  const result = await query<ActiveBannerRow>(
    `
      SELECT
        id,
        placement,
        name,
        target_url,
        sort_order,
        starts_at,
        ends_at,
        (mobile_image_data IS NOT NULL) AS has_mobile_image,
        updated_at
      FROM public.site_banners
      WHERE placement = $1
        AND status = 'active'
        AND image_data IS NOT NULL
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY sort_order, updated_at DESC
    `,
    [placement],
  );

  return result.rows.map((row) => ({
    id: row.id,
    placement: row.placement,
    name: row.name,
    targetUrl: row.target_url || "",
    sortOrder: Number(row.sort_order || 0),
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    hasMobileImage: Boolean(row.has_mobile_image),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function getActiveBannerImage(
  bannerId: string,
  variant: "desktop" | "mobile",
) {
  const result = await query<{
    image_data: Buffer;
    image_mime_type: string;
    image_filename: string | null;
  }>(
    variant === "mobile"
      ? `
      SELECT
        COALESCE(mobile_image_data, image_data) AS image_data,
        COALESCE(mobile_image_mime_type, image_mime_type) AS image_mime_type,
        COALESCE(mobile_image_filename, image_filename) AS image_filename
      FROM public.site_banners
      WHERE id = $1
        AND status = 'active'
        AND image_data IS NOT NULL
        AND image_mime_type IS NOT NULL
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      LIMIT 1
    `
      : `
      SELECT image_data, image_mime_type, image_filename
      FROM public.site_banners
      WHERE id = $1
        AND status = 'active'
        AND image_data IS NOT NULL
        AND image_mime_type IS NOT NULL
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      LIMIT 1
    `,
    [bannerId],
  );
  return result.rows[0] || null;
}

export function isBannerPlacement(value: string): value is BannerPlacement {
  return (BANNER_PLACEMENTS as readonly string[]).includes(value);
}
