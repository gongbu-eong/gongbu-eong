import { QueryResultRow } from "pg";
import { query } from "@/lib/db";

export type ShortLinkRow = QueryResultRow & {
  id: string;
  code: string;
  target_url: string;
  title: string | null;
  description: string | null;
  channel: string | null;
  placement: string | null;
};

export async function resolveShortLink(args: {
  code: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const result = await query<ShortLinkRow>(
    `
      WITH link AS (
        SELECT
          id,
          code,
          target_url,
          title,
          description,
          channel,
          placement
        FROM public.short_links
        WHERE code = $1
          AND is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at >= NOW())
        LIMIT 1
      ),
      click AS (
        INSERT INTO public.short_link_clicks (
          short_link_id,
          code,
          user_id,
          ip_address,
          user_agent,
          referrer,
          metadata
        )
        SELECT
          link.id,
          link.code,
          $2::uuid,
          $3::inet,
          $4,
          $5,
          $6::jsonb
        FROM link
        RETURNING id
      )
      SELECT
        id,
        code,
        target_url,
        title,
        description,
        channel,
        placement
      FROM link
    `,
    [
      args.code,
      args.userId || null,
      args.ipAddress || null,
      args.userAgent || null,
      args.referrer || null,
      JSON.stringify(args.metadata || {}),
    ],
  );

  return result.rows[0] ?? null;
}
