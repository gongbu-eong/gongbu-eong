import { query } from "@/lib/db";
import { CreateAccessLogRequestDto } from "./access.dto";

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
      args.body.entrySource || "unknown",
      args.ipAddress || null,
      args.userAgent || null,
      JSON.stringify(args.body.metadata || {}),
    ],
  );
}
