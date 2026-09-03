import { db } from "@/lib/db";
import { sendAlimtalk } from "@/lib/alimtalk";

export type NotificationCategory =
  | "job_deadline"
  | "community"
  | "coaching_credit"
  | "notice";
export type NotificationChannel =
  | "in_app"
  | "kakao"
  | "kakao_alimtalk"
  | "email"
  | "sms"
  | "push";

export type UserNotificationDto = {
  id: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  kind: string | null;
  title: string;
  body: string;
  targetPath: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  channel: NotificationChannel;
  category: NotificationCategory | null;
  kind: string | null;
  title: string;
  body: string;
  target_path: string | null;
  metadata: unknown;
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
          channel,
          COALESCE(category, 'notice') AS category,
          kind,
          title,
          body,
          target_path,
          metadata,
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
        channel,
        COALESCE(category, 'notice') AS category,
        kind,
        title,
        body,
        target_path,
        metadata,
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
  channel?: NotificationChannel;
  targetPath?: string | null;
  sentAt?: Date | null;
  category?: NotificationCategory;
  kind?: string | null;
  metadata?: Record<string, unknown>;
  sourceType?: string | null;
  sourceId?: string | null;
  client?: Pick<typeof db, "query">;
}) {
  const client = args.client || db;
  const result = await client.query<NotificationRow>(
    `
      INSERT INTO public.notifications (
        user_id,
        channel,
        category,
        kind,
        title,
        body,
        target_path,
        metadata,
        source_type,
        source_id,
        sent_at
      )
      VALUES ($1, $2::public.notification_channel, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
      ON CONFLICT (user_id, source_type, source_id)
      WHERE source_type IS NOT NULL AND source_id IS NOT NULL
      DO UPDATE SET
        channel = EXCLUDED.channel,
        category = EXCLUDED.category,
        kind = EXCLUDED.kind,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        target_path = EXCLUDED.target_path,
        metadata = EXCLUDED.metadata,
        sent_at = COALESCE(public.notifications.sent_at, EXCLUDED.sent_at)
      RETURNING
        id,
        channel,
        COALESCE(category, 'notice') AS category,
        kind,
        title,
        body,
        target_path,
        metadata,
        read_at,
        sent_at,
        created_at
    `,
    [
      args.userId,
      args.channel || "in_app",
      args.category || "notice",
      args.kind || null,
      args.title,
      args.body,
      args.targetPath || null,
      JSON.stringify(args.metadata || {}),
      args.sourceType || null,
      args.sourceId || null,
      args.sentAt || null,
    ],
  );

  return toNotificationDto(result.rows[0]);
}

export async function createCreditNotification(
  client: Pick<typeof db, "query">,
  args: {
    userId: string;
    transactionId: string;
    amount: number;
    transactionType: string;
    reason: string;
    balanceAfter: number;
  },
) {
  const isUse = args.amount < 0;
  const isRefund = args.transactionType === "refund";
  const title = isUse
    ? "진단권 사용"
    : isRefund
      ? "진단권 환불"
      : "진단권 획득";
  const body = isUse
    ? `진단권 ${Math.abs(args.amount)}장을 사용했습니다.`
    : `진단권 ${args.amount}장이 추가되었습니다.`;

  return createInAppNotification({
    userId: args.userId,
    title,
    body,
    category: "coaching_credit",
    kind: isUse ? "credit_use" : isRefund ? "credit_refund" : "credit_grant",
    sourceType: "credit_transaction",
    sourceId: args.transactionId,
    metadata: {
      amount: args.amount,
      balanceAfter: args.balanceAfter,
      reason: args.reason,
      transactionType: args.transactionType,
    },
    client,
  });
}

export async function notifyCommunityComment(
  commentId: string,
  args: { replyTargetCommentId?: string | null } = {},
) {
  const target = await findCommunityCommentNotificationTarget(
    commentId,
    args.replyTargetCommentId || null,
  );
  if (!target || target.actor_user_id === target.recipient_user_id) return null;

  const isReply = Boolean(target.parent_comment_id);
  const targetPath = `/community/${target.post_id}`;
  const title = "새로운 답글 안내";
  const body = isReply
    ? "회원님이 작성한 댓글에 새로운 답글이 달렸습니다."
    : "회원님이 작성한 게시글에 새로운 댓글이 달렸습니다.";
  const alimtalkMessage = buildCommunityAlimtalkMessage({
    isReply,
    memberName: target.recipient_name || "회원",
    authorNickname: target.actor_nickname || "공부엉이",
    postTitle: target.post_title,
  });
  let sentAt: Date | null = null;
  let alimtalkSent = false;
  let alimtalkSkipReason: string | null = null;

  if (target.recipient_phone && target.kakao_enabled) {
    const templateCode = isReply
      ? process.env.NEXT_PRIVATE_GONGBUEONG_NEW_REPLY_TEMPLATE_KEY
      : process.env.NEXT_PRIVATE_GONGBUEONG_NEW_COMMENT_TEMPLATE_KEY;

    try {
      const result = await sendAlimtalk({
        recipientPhone: target.recipient_phone,
        templateCode,
        message: alimtalkMessage,
        title,
        targetPath,
        buttonName: "확인",
      });
      alimtalkSent = result.sent;
      sentAt = result.sent ? new Date() : null;
      alimtalkSkipReason = result.sent
        ? null
        : result.reason || "alimtalk_not_sent";
    } catch (error) {
      alimtalkSkipReason = "alimtalk_insert_failed";
      console.error("[Notification] community alimtalk failed", error);
    }
  } else if (!target.recipient_phone) {
    alimtalkSkipReason = "missing_recipient_phone";
  } else {
    alimtalkSkipReason = "kakao_disabled";
  }

  return createInAppNotification({
    userId: target.recipient_user_id,
    title,
    body,
    channel: alimtalkSent ? "kakao_alimtalk" : "in_app",
    targetPath,
    sentAt,
    category: "community",
    kind: isReply ? "community_reply" : "community_comment",
    sourceType: isReply ? "community_reply" : "community_comment",
    sourceId: commentId,
    metadata: {
      postId: target.post_id,
      postTitle: target.post_title,
      commentId,
      replyTargetCommentId: args.replyTargetCommentId || null,
      actorUserId: target.actor_user_id,
      actorNickname: target.actor_nickname,
      alimtalkSent,
      alimtalkSkipReason,
    },
  });
}

async function findCommunityCommentNotificationTarget(
  commentId: string,
  replyTargetCommentId: string | null,
) {
  const result = await db.query<{
    comment_id: string;
    post_id: string;
    post_title: string;
    parent_comment_id: string | null;
    actor_user_id: string;
    actor_nickname: string | null;
    recipient_user_id: string;
    recipient_name: string | null;
    recipient_phone: string | null;
    kakao_enabled: boolean | null;
  }>(
    `
      SELECT
        comments.id AS comment_id,
        posts.id AS post_id,
        posts.title AS post_title,
        comments.parent_comment_id,
        actor.id AS actor_user_id,
        COALESCE(actor.community_nickname, actor.nickname, actor.display_name, '공부엉이') AS actor_nickname,
        recipient.id AS recipient_user_id,
        COALESCE(recipient.display_name, recipient.nickname, recipient.community_nickname, '회원') AS recipient_name,
        recipient.phone AS recipient_phone,
        preferences.kakao_enabled
      FROM public.community_comments comments
      JOIN public.community_posts posts
        ON posts.id = comments.post_id
       AND posts.status = 'active'
      JOIN public.users actor
        ON actor.id = comments.user_id
      LEFT JOIN public.community_comments parent
        ON parent.id = comments.parent_comment_id
      LEFT JOIN public.community_comments requested_parent
        ON requested_parent.id = $2::uuid
       AND requested_parent.post_id = comments.post_id
       AND requested_parent.status = 'active'
      JOIN public.users recipient
        ON recipient.id = CASE
          WHEN comments.parent_comment_id IS NULL THEN posts.user_id
          ELSE COALESCE(requested_parent.user_id, parent.user_id)
        END
       AND recipient.status = 'active'
      LEFT JOIN public.notification_preferences preferences
        ON preferences.user_id = recipient.id
      WHERE comments.id = $1
        AND comments.status = 'active'
      LIMIT 1
    `,
    [commentId, replyTargetCommentId],
  );

  return result.rows[0] || null;
}

function buildCommunityAlimtalkMessage(args: {
  isReply: boolean;
  memberName: string;
  authorNickname: string;
  postTitle: string;
}) {
  return args.isReply
    ? [
        "[새로운 답글 안내]",
        "",
        `${args.memberName}님, 안녕하세요.`,
        "",
        "회원님이 아래 게시글에 작성한 댓글에",
        `「${args.authorNickname}」님이 새로운 답글을 남겼습니다.`,
        "",
        `게시글: ${args.postTitle}`,
        "",
        "본 알림은 댓글 알림 수신 동의자에 한해 발송되며,",
        "알림 수신은 마이페이지 > 알림 설정에서 변경 가능합니다.",
        "",
        "아래 버튼을 눌러 내용을 확인해 주세요.",
      ].join("\n")
    : [
        "[새로운 답글 안내]",
        "",
        `${args.memberName}님, 안녕하세요.`,
        "",
        "회원님이 작성한 게시글에",
        `「${args.authorNickname}」님이 새로운 댓글을 남겼습니다.`,
        "",
        `게시글: ${args.postTitle}`,
        "",
        "본 알림은 댓글 알림 수신 동의자에 한해 발송되며,",
        "알림 수신은 마이페이지 > 알림 설정에서 변경 가능합니다.",
        "",
        "아래 버튼을 눌러 내용을 확인해 주세요.",
      ].join("\n");
}

function toNotificationDto(row: NotificationRow): UserNotificationDto {
  return {
    id: row.id,
    channel: row.channel,
    category: row.category || "notice",
    kind: row.kind,
    title: row.title,
    body: row.body,
    targetPath: row.target_path,
    metadata: normalizeMetadata(row.metadata),
    readAt: toIso(row.read_at),
    sentAt: toIso(row.sent_at),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
  };
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
