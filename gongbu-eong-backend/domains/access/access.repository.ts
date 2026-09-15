import { query } from "@/lib/db";
import { CreateAccessLogRequestDto } from "./access.dto";

const entrySourceAliases: Record<string, string> = {
  coaching: "ai_tools",
};

const validEntrySources = new Set([
  "main_home",
  "diagnosis",
  "strength_diagnosis",
  "ai_tools",
  "calendar",
  "community",
  "my_page",
  "jobs",
  "unknown",
]);

function normalizeEntrySource(value?: string) {
  const normalized = (value || "").trim();
  const mapped = entrySourceAliases[normalized] || normalized;

  return validEntrySources.has(mapped) ? mapped : "unknown";
}

export function createAccessLog(args: {
  body: CreateAccessLogRequestDto;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const metadata = {
    ...(args.body.metadata || {}),
    sessionId: normalizeUuid(args.body.sessionId),
    previousPath: normalizeText(args.body.previousPath, 2048),
    canonicalPath: normalizeText(args.body.canonicalPath, 255),
    screenKey: normalizeText(args.body.screenKey, 80),
    trafficChannel: normalizeText(args.body.trafficChannel, 100),
  };

  return query(
    `
      INSERT INTO public.access_logs (
        user_id,
        anonymous_id,
        session_id,
        event_name,
        path,
        title,
        referrer,
        previous_path,
        canonical_path,
        screen_key,
        traffic_channel,
        entry_source,
        ip_address,
        user_agent,
        metadata
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
        $12::public.entry_source,
        $13,
        $14,
        $15::jsonb
      )
    `,
    [
      args.userId || null,
      args.body.anonymousId || null,
      normalizeUuid(args.body.sessionId),
      args.body.eventName || "page_view",
      args.body.path,
      args.body.title || null,
      args.body.referrer || null,
      normalizeText(args.body.previousPath, 2048),
      normalizeText(args.body.canonicalPath, 255),
      normalizeText(args.body.screenKey, 80),
      normalizeText(args.body.trafficChannel, 100),
      normalizeEntrySource(args.body.entrySource),
      args.ipAddress || null,
      args.userAgent || null,
      JSON.stringify(metadata),
    ],
  );
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, maxLength);
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    trimmed,
  )
    ? trimmed
    : null;
}
