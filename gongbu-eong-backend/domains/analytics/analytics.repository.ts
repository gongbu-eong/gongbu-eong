import { query } from "@/lib/db";
import type {
  AttributionSnapshotDto,
  ProductEventAttributionContextDto,
  SaveAttributionRequestDto,
} from "./analytics.dto";

type AttributionSnapshot = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  gclid: string | null;
  fbclid: string | null;
  landingUrl: string | null;
  landingPath: string | null;
  referrer: string | null;
  seenAt: string | null;
  raw: AttributionSnapshotDto;
};

export async function saveAttribution(args: {
  body: SaveAttributionRequestDto;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const anonymousId = isUuid(args.body.anonymousId || "") ? args.body.anonymousId || null : null;
  const first = normalizeSnapshot(args.body.first);
  const last = normalizeSnapshot(args.body.last);
  const current = normalizeSnapshot(args.body.current);

  if (current) {
    await insertAttributionEvent({
      userId: args.userId,
      anonymousId,
      eventName: "attribution_capture",
      snapshot: current,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });
  }

  if (!args.userId || (!first && !last)) {
    return { saved: Boolean(current), linkedToUser: false };
  }

  await upsertUserAttribution({
    userId: args.userId,
    first,
    last,
  });

  return { saved: true, linkedToUser: true };
}

export async function recordDiagnosisCompleteEvent(args: {
  userId?: string;
  anonymousId?: string;
  diagnosisRunId: string;
  diagnosisResultId: string;
  diagnosisType: string;
  attribution?: ProductEventAttributionContextDto | null;
  properties?: Record<string, unknown>;
}) {
  const first = normalizeSnapshot(args.attribution?.first);
  const current =
    normalizeSnapshot(args.attribution?.current) ||
    normalizeSnapshot(args.attribution?.last);
  const anonymousId = isUuid(args.anonymousId || "") ? args.anonymousId || null : null;

  const result = await query<{ attempt_no: number }>(
    `
      WITH existing AS (
        SELECT attempt_no
        FROM public.product_events
        WHERE event_type = $5::varchar
          AND diagnosis_run_id = $3::uuid
        LIMIT 1
      ),
      user_saved_attribution AS (
        SELECT
          first_source,
          first_medium,
          first_campaign,
          first_content,
          first_term,
          first_gclid,
          first_fbclid,
          first_landing_url,
          first_landing_path,
          first_referrer,
          first_seen_at,
          first_raw_payload,
          last_source,
          last_medium,
          last_campaign,
          last_content,
          last_term,
          last_gclid,
          last_fbclid,
          last_landing_url,
          last_landing_path,
          last_referrer,
          last_seen_at,
          last_raw_payload
        FROM public.user_attributions
        WHERE user_id = $1::uuid
        LIMIT 1
      ),
      attempt AS (
        SELECT COALESCE(MAX(attempt_no), 0) + 1 AS attempt_no
        FROM public.product_events
        WHERE event_type = $5::varchar
          AND (
            ($1::uuid IS NOT NULL AND user_id = $1::uuid)
            OR ($1::uuid IS NULL AND $2::uuid IS NOT NULL AND anonymous_id = $2::uuid)
          )
      ),
      inserted AS (
        INSERT INTO public.product_events (
          user_id,
          anonymous_id,
          event_type,
          event_source,
          first_source,
          first_medium,
          first_campaign,
          first_content,
          first_term,
          first_gclid,
          first_fbclid,
          first_landing_url,
          first_landing_path,
          first_referrer,
          first_seen_at,
          first_raw_payload,
          current_source,
          current_medium,
          current_campaign,
          current_content,
          current_term,
          current_gclid,
          current_fbclid,
          current_landing_url,
          current_landing_path,
          current_referrer,
          current_seen_at,
          current_raw_payload,
          diagnosis_run_id,
          diagnosis_result_id,
          attempt_no,
          properties
        )
        SELECT
          $1::uuid,
          $2::uuid,
          $5::varchar,
          $6::varchar,
          COALESCE($7::varchar, user_saved_attribution.first_source),
          COALESCE($8::varchar, user_saved_attribution.first_medium),
          COALESCE($9::varchar, user_saved_attribution.first_campaign),
          COALESCE($10::varchar, user_saved_attribution.first_content),
          COALESCE($11::varchar, user_saved_attribution.first_term),
          COALESCE($12::varchar, user_saved_attribution.first_gclid),
          COALESCE($13::varchar, user_saved_attribution.first_fbclid),
          COALESCE($14::text, user_saved_attribution.first_landing_url),
          COALESCE($15::text, user_saved_attribution.first_landing_path),
          COALESCE($16::text, user_saved_attribution.first_referrer),
          COALESCE($17::timestamptz, user_saved_attribution.first_seen_at),
          COALESCE($18::jsonb, user_saved_attribution.first_raw_payload),
          COALESCE($19::varchar, user_saved_attribution.last_source),
          COALESCE($20::varchar, user_saved_attribution.last_medium),
          COALESCE($21::varchar, user_saved_attribution.last_campaign),
          COALESCE($22::varchar, user_saved_attribution.last_content),
          COALESCE($23::varchar, user_saved_attribution.last_term),
          COALESCE($24::varchar, user_saved_attribution.last_gclid),
          COALESCE($25::varchar, user_saved_attribution.last_fbclid),
          COALESCE($26::text, user_saved_attribution.last_landing_url),
          COALESCE($27::text, user_saved_attribution.last_landing_path),
          COALESCE($28::text, user_saved_attribution.last_referrer),
          COALESCE($29::timestamptz, user_saved_attribution.last_seen_at),
          COALESCE($30::jsonb, user_saved_attribution.last_raw_payload),
          $3::uuid,
          $4::uuid,
          attempt.attempt_no,
          $31::jsonb
        FROM attempt
        LEFT JOIN user_saved_attribution ON TRUE
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        ON CONFLICT DO NOTHING
        RETURNING attempt_no
      )
      SELECT attempt_no FROM inserted
      UNION ALL
      SELECT attempt_no FROM existing
      LIMIT 1
    `,
    [
      args.userId || null,
      anonymousId,
      args.diagnosisRunId,
      args.diagnosisResultId,
      "diagnosis_complete",
      "server",
      first?.source || null,
      first?.medium || null,
      first?.campaign || null,
      first?.content || null,
      first?.term || null,
      first?.gclid || null,
      first?.fbclid || null,
      first?.landingUrl || null,
      first?.landingPath || null,
      first?.referrer || null,
      first?.seenAt || null,
      first ? JSON.stringify(first.raw) : null,
      current?.source || null,
      current?.medium || null,
      current?.campaign || null,
      current?.content || null,
      current?.term || null,
      current?.gclid || null,
      current?.fbclid || null,
      current?.landingUrl || null,
      current?.landingPath || null,
      current?.referrer || null,
      current?.seenAt || null,
      current ? JSON.stringify(current.raw) : null,
      JSON.stringify({
        diagnosis_type: args.diagnosisType,
        ...(args.properties || {}),
      }),
    ],
  );

  return { attemptNo: result.rows[0]?.attempt_no ?? null };
}

function insertAttributionEvent(args: {
  userId?: string;
  anonymousId: string | null;
  eventName: string;
  snapshot: AttributionSnapshot;
  ipAddress?: string;
  userAgent?: string;
}) {
  return query(
    `
      INSERT INTO public.attribution_events (
        user_id,
        anonymous_id,
        event_name,
        source,
        medium,
        campaign,
        content,
        term,
        gclid,
        fbclid,
        landing_url,
        landing_path,
        referrer,
        ip_address,
        user_agent,
        raw_payload,
        captured_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16::jsonb,
        COALESCE($17::timestamptz, NOW())
      )
    `,
    [
      args.userId || null,
      args.anonymousId,
      args.eventName,
      args.snapshot.source,
      args.snapshot.medium,
      args.snapshot.campaign,
      args.snapshot.content,
      args.snapshot.term,
      args.snapshot.gclid,
      args.snapshot.fbclid,
      args.snapshot.landingUrl,
      args.snapshot.landingPath,
      args.snapshot.referrer,
      args.ipAddress || null,
      args.userAgent || null,
      JSON.stringify(args.snapshot.raw),
      args.snapshot.seenAt,
    ],
  );
}

function upsertUserAttribution(args: {
  userId: string;
  first: AttributionSnapshot | null;
  last: AttributionSnapshot | null;
}) {
  return query(
    `
      INSERT INTO public.user_attributions (
        user_id,
        first_source,
        first_medium,
        first_campaign,
        first_content,
        first_term,
        first_gclid,
        first_fbclid,
        first_landing_url,
        first_landing_path,
        first_referrer,
        first_seen_at,
        first_raw_payload,
        last_source,
        last_medium,
        last_campaign,
        last_content,
        last_term,
        last_gclid,
        last_fbclid,
        last_landing_url,
        last_landing_path,
        last_referrer,
        last_seen_at,
        last_raw_payload
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12::timestamptz,
        $13::jsonb,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24::timestamptz,
        $25::jsonb
      )
      ON CONFLICT (user_id) DO UPDATE SET
        first_source = COALESCE(public.user_attributions.first_source, EXCLUDED.first_source),
        first_medium = COALESCE(public.user_attributions.first_medium, EXCLUDED.first_medium),
        first_campaign = COALESCE(public.user_attributions.first_campaign, EXCLUDED.first_campaign),
        first_content = COALESCE(public.user_attributions.first_content, EXCLUDED.first_content),
        first_term = COALESCE(public.user_attributions.first_term, EXCLUDED.first_term),
        first_gclid = COALESCE(public.user_attributions.first_gclid, EXCLUDED.first_gclid),
        first_fbclid = COALESCE(public.user_attributions.first_fbclid, EXCLUDED.first_fbclid),
        first_landing_url = COALESCE(public.user_attributions.first_landing_url, EXCLUDED.first_landing_url),
        first_landing_path = COALESCE(public.user_attributions.first_landing_path, EXCLUDED.first_landing_path),
        first_referrer = COALESCE(public.user_attributions.first_referrer, EXCLUDED.first_referrer),
        first_seen_at = COALESCE(public.user_attributions.first_seen_at, EXCLUDED.first_seen_at),
        first_raw_payload = COALESCE(public.user_attributions.first_raw_payload, EXCLUDED.first_raw_payload),
        last_source = COALESCE(EXCLUDED.last_source, public.user_attributions.last_source),
        last_medium = COALESCE(EXCLUDED.last_medium, public.user_attributions.last_medium),
        last_campaign = COALESCE(EXCLUDED.last_campaign, public.user_attributions.last_campaign),
        last_content = COALESCE(EXCLUDED.last_content, public.user_attributions.last_content),
        last_term = COALESCE(EXCLUDED.last_term, public.user_attributions.last_term),
        last_gclid = COALESCE(EXCLUDED.last_gclid, public.user_attributions.last_gclid),
        last_fbclid = COALESCE(EXCLUDED.last_fbclid, public.user_attributions.last_fbclid),
        last_landing_url = COALESCE(EXCLUDED.last_landing_url, public.user_attributions.last_landing_url),
        last_landing_path = COALESCE(EXCLUDED.last_landing_path, public.user_attributions.last_landing_path),
        last_referrer = COALESCE(EXCLUDED.last_referrer, public.user_attributions.last_referrer),
        last_seen_at = COALESCE(EXCLUDED.last_seen_at, public.user_attributions.last_seen_at),
        last_raw_payload = COALESCE(EXCLUDED.last_raw_payload, public.user_attributions.last_raw_payload),
        updated_at = NOW()
    `,
    [
      args.userId,
      args.first?.source || null,
      args.first?.medium || null,
      args.first?.campaign || null,
      args.first?.content || null,
      args.first?.term || null,
      args.first?.gclid || null,
      args.first?.fbclid || null,
      args.first?.landingUrl || null,
      args.first?.landingPath || null,
      args.first?.referrer || null,
      args.first?.seenAt || null,
      args.first ? JSON.stringify(args.first.raw) : null,
      args.last?.source || null,
      args.last?.medium || null,
      args.last?.campaign || null,
      args.last?.content || null,
      args.last?.term || null,
      args.last?.gclid || null,
      args.last?.fbclid || null,
      args.last?.landingUrl || null,
      args.last?.landingPath || null,
      args.last?.referrer || null,
      args.last?.seenAt || null,
      args.last ? JSON.stringify(args.last.raw) : null,
    ],
  );
}

function normalizeSnapshot(value?: AttributionSnapshotDto | null): AttributionSnapshot | null {
  if (!value || typeof value !== "object") return null;

  const snapshot = {
    source: clean(value.utm_source, { lowercase: true, maxLength: 100 }),
    medium: clean(value.utm_medium, { lowercase: true, maxLength: 100 }),
    campaign: clean(value.utm_campaign, { lowercase: true, maxLength: 200 }),
    content: clean(value.utm_content, { lowercase: true, maxLength: 200 }),
    term: clean(value.utm_term, { lowercase: true, maxLength: 200 }),
    gclid: clean(value.gclid, { maxLength: 255 }),
    fbclid: clean(value.fbclid, { maxLength: 255 }),
    landingUrl: clean(value.landingUrl, { maxLength: 2048 }),
    landingPath: clean(value.landingPath, { maxLength: 1024 }),
    referrer: clean(value.referrer, { maxLength: 2048 }),
    seenAt: isValidDate(value.capturedAt) ? value.capturedAt || null : null,
    raw: value,
  };

  if (
    !snapshot.source &&
    !snapshot.medium &&
    !snapshot.campaign &&
    !snapshot.content &&
    !snapshot.term &&
    !snapshot.gclid &&
    !snapshot.fbclid
  ) {
    return null;
  }

  return snapshot;
}

function clean(
  value: unknown,
  options: { lowercase?: boolean; maxLength: number },
) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = options.lowercase ? trimmed.toLowerCase() : trimmed;
  return normalized.slice(0, options.maxLength);
}

function isValidDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
