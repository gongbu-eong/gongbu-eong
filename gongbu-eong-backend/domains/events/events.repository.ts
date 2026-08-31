import { QueryResultRow } from "pg";
import { db, query } from "@/lib/db";

export type EventStatus = "draft" | "active" | "paused" | "ended";

export type EventDefinitionRow = QueryResultRow & {
  id: string;
  event_no: string;
  slug: string;
  title: string;
  status: EventStatus;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  event_base_url: string | null;
  local_event_base_url: string | null;
  entry_path: string;
  result_path: string | null;
};

export type PublicEventListRow = QueryResultRow & {
  event_no: string;
  slug: string;
  title: string;
  description: string | null;
  badge: string | null;
  thumbnail_url: string | null;
  entry_path: string;
  participant_count: string | number;
};

export type EventTicketRow = QueryResultRow & {
  id: string;
  event_id: string;
  event_no: string;
  status: EventStatus;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  user_id: string | null;
  session_token_hash: string | null;
  return_path: string | null;
  expires_at: Date | string;
  consumed_at: Date | string | null;
};

export type EventSessionRow = QueryResultRow & {
  id: string;
  event_id: string;
  event_no: string;
  user_id: string | null;
  expires_at: Date | string;
};

export async function findEventByNo(eventNo: string) {
  const result = await query<EventDefinitionRow>(
    `
      SELECT
        id,
        event_no,
        slug,
        title,
        status,
        starts_at,
        ends_at,
        event_base_url,
        local_event_base_url,
        entry_path,
        result_path
      FROM public.event_definitions
      WHERE event_no = $1
      LIMIT 1
    `,
    [eventNo],
  );

  return result.rows[0] ?? null;
}

export async function findPublicEventListings() {
  const result = await query<PublicEventListRow>(`
    WITH event_counts AS (
      SELECT
        events.id AS event_id,
        CASE
          WHEN events.event_no = '1' THEN (
            SELECT COUNT(*)
            FROM public.diagnosis_runs runs
            WHERE runs.completed_at IS NOT NULL
          )
          ELSE COUNT(DISTINCT sessions.id)
        END AS participant_count
      FROM public.event_definitions events
      LEFT JOIN public.event_sessions sessions
        ON sessions.event_id = events.id
      WHERE events.is_listed = TRUE
        AND events.status = 'active'
        AND (events.starts_at IS NULL OR events.starts_at <= NOW())
        AND (events.ends_at IS NULL OR events.ends_at >= NOW())
      GROUP BY events.id, events.event_no
    )
    SELECT
      events.event_no,
      events.slug,
      COALESCE(events.list_title, events.title) AS title,
      events.list_description AS description,
      events.display_badge AS badge,
      events.thumbnail_url,
      COALESCE(events.public_path, events.entry_path) AS entry_path,
      event_counts.participant_count
    FROM public.event_definitions events
    JOIN event_counts
      ON event_counts.event_id = events.id
    ORDER BY
      event_counts.participant_count DESC,
      events.display_order ASC,
      events.created_at DESC
  `);

  return result.rows;
}

export async function insertEventEntryTicket(args: {
  eventId: string;
  ticketHash: string;
  userId?: string | null;
  sessionTokenHash?: string | null;
  returnPath: string;
  sourcePath?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
}) {
  const result = await query<{ id: string }>(
    `
      INSERT INTO public.event_entry_tickets (
        event_id,
        ticket_hash,
        user_id,
        session_token_hash,
        return_path,
        source_path,
        ip_address,
        user_agent,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9)
      RETURNING id
    `,
    [
      args.eventId,
      args.ticketHash,
      args.userId ?? null,
      args.sessionTokenHash ?? null,
      args.returnPath,
      args.sourcePath ?? null,
      args.ipAddress ?? null,
      args.userAgent ?? null,
      args.expiresAt,
    ],
  );

  return result.rows[0].id;
}

export async function consumeEventEntryTicket(args: {
  ticketHash: string;
  eventSessionTokenHash: string;
  currentSessionTokenHash?: string | null;
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ticketResult = await client.query<EventTicketRow>(
      `
        SELECT
          tickets.id,
          tickets.event_id,
          events.event_no,
          events.status,
          events.starts_at,
          events.ends_at,
          tickets.user_id,
          tickets.session_token_hash,
          tickets.return_path,
          tickets.expires_at,
          tickets.consumed_at
        FROM public.event_entry_tickets tickets
        JOIN public.event_definitions events
          ON events.id = tickets.event_id
        WHERE tickets.ticket_hash = $1
        LIMIT 1
        FOR UPDATE OF tickets
      `,
      [args.ticketHash],
    );

    const ticket = ticketResult.rows[0] ?? null;

    if (!ticket) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "invalid_ticket" as const };
    }

    const now = new Date();
    const startsAt = ticket.starts_at ? new Date(ticket.starts_at) : null;
    const endsAt = ticket.ends_at ? new Date(ticket.ends_at) : null;
    const expiresAt = new Date(ticket.expires_at);

    if (ticket.status !== "active" || (startsAt && startsAt > now) || (endsAt && endsAt < now)) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "event_inactive" as const };
    }

    if (ticket.consumed_at || expiresAt < now) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "expired_ticket" as const };
    }

    if (
      ticket.session_token_hash &&
      ticket.session_token_hash !== (args.currentSessionTokenHash ?? null)
    ) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "session_mismatch" as const };
    }

    const sessionExpiresAt =
      endsAt && endsAt.getTime() < now.getTime() + 2 * 60 * 60 * 1000
        ? endsAt
        : new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await client.query(
      `
        UPDATE public.event_entry_tickets
        SET consumed_at = NOW()
        WHERE id = $1
      `,
      [ticket.id],
    );

    await client.query(
      `
        INSERT INTO public.event_sessions (
          event_id,
          entry_ticket_id,
          session_token_hash,
          user_id,
          source_session_token_hash,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        ticket.event_id,
        ticket.id,
        args.eventSessionTokenHash,
        ticket.user_id,
        args.currentSessionTokenHash ?? null,
        sessionExpiresAt,
      ],
    );

    await client.query("COMMIT");

    return {
      ok: true as const,
      eventNo: ticket.event_no,
      returnPath: ticket.return_path,
      expiresAt: sessionExpiresAt,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function validateEventSession(args: {
  eventNo: string;
  sessionTokenHash: string;
}) {
  const result = await query<EventSessionRow>(
    `
      UPDATE public.event_sessions sessions
      SET last_seen_at = NOW()
      FROM public.event_definitions events
      WHERE events.id = sessions.event_id
        AND events.event_no = $1
        AND events.status = 'active'
        AND (events.starts_at IS NULL OR events.starts_at <= NOW())
        AND (events.ends_at IS NULL OR events.ends_at >= NOW())
        AND sessions.session_token_hash = $2
        AND sessions.expires_at > NOW()
      RETURNING
        sessions.id,
        sessions.event_id,
        events.event_no,
        sessions.user_id,
        sessions.expires_at
    `,
    [args.eventNo, args.sessionTokenHash],
  );

  return result.rows[0] ?? null;
}
