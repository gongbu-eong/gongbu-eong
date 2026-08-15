import { db } from "@/lib/db";

export type UserNotificationDto = {
  id: string;
  title: string;
  body: string;
  targetPath: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  target_path: string | null;
  read_at: Date | string | null;
  sent_at: Date | string | null;
  created_at: Date | string;
};

export async function listUserNotifications(
  userId: string,
  args: { limit: number; offset: number },
) {
  const [itemsResult, unreadResult] = await Promise.all([
    db.query<NotificationRow>(
      `
        SELECT
          id,
          title,
          body,
          target_path,
          read_at,
          sent_at,
          created_at
        FROM public.notifications
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        OFFSET $3
      `,
      [userId, args.limit, args.offset],
    ),
    countUnreadNotifications(userId),
  ]);

  return {
    items: itemsResult.rows.map(toNotificationDto),
    unreadCount: unreadResult,
  };
}

export async function countUnreadNotifications(userId: string) {
  const result = await db.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM public.notifications
      WHERE user_id = $1
        AND read_at IS NULL
    `,
    [userId],
  );

  return Number(result.rows[0]?.count || 0);
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  const result = await db.query<NotificationRow>(
    `
      UPDATE public.notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $2
        AND user_id = $1
      RETURNING
        id,
        title,
        body,
        target_path,
        read_at,
        sent_at,
        created_at
    `,
    [userId, notificationId],
  );

  return result.rows[0] ? toNotificationDto(result.rows[0]) : null;
}

export async function createInAppNotification(args: {
  userId: string;
  title: string;
  body: string;
  targetPath?: string | null;
  sentAt?: Date | null;
}) {
  const result = await db.query<NotificationRow>(
    `
      INSERT INTO public.notifications (
        user_id,
        channel,
        title,
        body,
        target_path,
        sent_at
      )
      VALUES ($1, 'in_app'::public.notification_channel, $2, $3, $4, $5)
      RETURNING
        id,
        title,
        body,
        target_path,
        read_at,
        sent_at,
        created_at
    `,
    [
      args.userId,
      args.title,
      args.body,
      args.targetPath || null,
      args.sentAt || null,
    ],
  );

  return toNotificationDto(result.rows[0]);
}

function toNotificationDto(row: NotificationRow): UserNotificationDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    targetPath: row.target_path,
    readAt: toIso(row.read_at),
    sentAt: toIso(row.sent_at),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
  };
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
