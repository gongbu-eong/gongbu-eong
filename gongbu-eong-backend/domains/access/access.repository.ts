import { query } from "@/lib/db";
import { CreateAccessLogRequestDto } from "./access.dto";

const entrySourceAliases: Record<string, string> = {
  coaching: "ai_tools",
};

const validEntrySources = new Set([
  "main_home",
  "diagnosis",
  "ai_tools",
  "calendar",
  "community",
  "my_page",
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
  return query(
    `
      INSERT INTO public.access_logs (
        user_id,
        anonymous_id,
        event_name,
        path,
        title,
        referrer,
        entry_source,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::public.entry_source, $8, $9, $10::jsonb)
    `,
    [
      args.userId || null,
      args.body.anonymousId || null,
      args.body.eventName || "page_view",
      args.body.path,
      args.body.title || null,
      args.body.referrer || null,
      normalizeEntrySource(args.body.entrySource),
      args.ipAddress || null,
      args.userAgent || null,
      JSON.stringify(args.body.metadata || {}),
    ],
  );
}
