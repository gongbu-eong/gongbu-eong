import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createInAppNotification } from "@/domains/notifications/notifications.repository";
import { db } from "@/lib/db";
import { sendAlimtalk } from "@/lib/alimtalk";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECIPIENTS = 100;
const SEND_CONCURRENCY = 5;

type TemplateGroup = "10s" | "20s" | "30s" | "40s" | "50plus";

type RecipientRow = {
  id: string;
  phone: string | null;
  age_group: string | null;
  template_group: TemplateGroup | null;
  marketing_agreed: boolean;
};

type SendOutcome = {
  status: "sent" | "skipped" | "failed";
  reason?: string;
};

export async function POST(request: Request) {
  const configuredKey = process.env.ADMIN_NOTIFICATION_API_KEY?.trim();
  const requestKey = request.headers.get("x-admin-notification-key")?.trim();
  if (!configuredKey || !requestKey || requestKey !== configuredKey) {
    return NextResponse.json(
      { ok: false, message: "알림 발송 API 인증에 실패했습니다." },
      { status: 401 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    userIds?: unknown;
    requestedBy?: unknown;
  } | null;
  const userIds = Array.isArray(payload?.userIds)
    ? Array.from(
        new Set(
          payload.userIds.filter(
            (value): value is string =>
              typeof value === "string" && UUID_PATTERN.test(value),
          ),
        ),
      )
    : [];
  const requestedBy =
    typeof payload?.requestedBy === "string" && UUID_PATTERN.test(payload.requestedBy)
      ? payload.requestedBy
      : null;

  if (!userIds.length || userIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { ok: false, message: `발송 대상은 1명 이상 ${MAX_RECIPIENTS}명 이하로 선택해 주세요.` },
      { status: 400 },
    );
  }

  const recipients = await findRecipients(userIds);
  const recipientMap = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const batchId = randomUUID();
  const outcomes: SendOutcome[] = [];

  for (let index = 0; index < userIds.length; index += SEND_CONCURRENCY) {
    const chunk = userIds.slice(index, index + SEND_CONCURRENCY);
    const chunkOutcomes = await Promise.all(
      chunk.map((userId) =>
        sendToRecipient({
          recipient: recipientMap.get(userId) || null,
          userId,
          batchId,
          requestedBy,
        }),
      ),
    );
    outcomes.push(...chunkOutcomes);
  }

  const reasons = outcomes.reduce<Record<string, number>>((result, outcome) => {
    if (outcome.reason) result[outcome.reason] = (result[outcome.reason] || 0) + 1;
    return result;
  }, {});
  const result = {
    requested: userIds.length,
    sent: outcomes.filter((outcome) => outcome.status === "sent").length,
    skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
    failed: outcomes.filter((outcome) => outcome.status === "failed").length,
    reasons,
    batchId,
  };

  return NextResponse.json({ ok: true, result });
}

async function findRecipients(userIds: string[]) {
  const result = await db.query<RecipientRow>(
    `
      SELECT
        users.id,
        users.phone,
        users.age_group,
        CASE
          WHEN users.age_group IN ('10-19', 'teens') THEN '10s'
          WHEN users.age_group IN ('20-29', 'early_20s', 'late_20s') THEN '20s'
          WHEN users.age_group IN ('30-39', 'early_30s', 'late_30s') THEN '30s'
          WHEN users.age_group = '40-49' THEN '40s'
          WHEN users.age_group IN ('50-59', '60-69', '70-79', '80-89', '90+') THEN '50plus'
          ELSE NULL
        END AS template_group,
        COALESCE(marketing_consent.agreed, preferences.marketing_enabled, false) AS marketing_agreed
      FROM public.users users
      LEFT JOIN public.notification_preferences preferences
        ON preferences.user_id = users.id
      LEFT JOIN LATERAL (
        SELECT consents.agreed
        FROM public.user_consents consents
        WHERE consents.user_id = users.id
          AND consents.terms_key = 'marketing_notifications'
        ORDER BY consents.updated_at DESC, consents.created_at DESC, consents.id DESC
        LIMIT 1
      ) marketing_consent ON TRUE
      WHERE users.id = ANY($1::uuid[])
        AND users.status = 'active'
    `,
    [userIds],
  );
  return result.rows;
}

async function sendToRecipient(args: {
  recipient: RecipientRow | null;
  userId: string;
  batchId: string;
  requestedBy: string | null;
}): Promise<SendOutcome> {
  const { recipient } = args;
  if (!recipient) return { status: "skipped", reason: "member_not_found_or_inactive" };
  if (!recipient.phone?.trim()) return { status: "skipped", reason: "phone_missing" };
  if (!recipient.template_group) return { status: "skipped", reason: "age_group_unsupported" };
  if (!recipient.marketing_agreed) return { status: "skipped", reason: "marketing_not_agreed" };

  const template = getTemplate(recipient.template_group);
  if (!template.code || !template.message) {
    return { status: "failed", reason: `template_config_missing_${recipient.template_group}` };
  }

  try {
    const sendResult = await sendAlimtalk({
      recipientPhone: recipient.phone,
      templateCode: template.code,
      message: template.message,
      title: template.title,
      targetPath: template.targetPath,
      buttonName: template.buttonName,
    });
    if (!sendResult.sent) return { status: "failed", reason: sendResult.reason };

    await createInAppNotification({
      userId: recipient.id,
      channel: "kakao_alimtalk",
      category: "notice",
      kind: "admin_age_campaign",
      title: template.title,
      body: template.message,
      targetPath: template.targetPath,
      sentAt: new Date(),
      sourceType: "admin_age_campaign",
      sourceId: `${args.batchId}:${recipient.id}`,
      metadata: {
        batchId: args.batchId,
        requestedBy: args.requestedBy,
        templateGroup: recipient.template_group,
        templateCode: template.code,
      },
    });
    return { status: "sent" };
  } catch (error) {
    console.error("[Admin Alimtalk] Send failed", {
      userId: recipient.id,
      batchId: args.batchId,
      error,
    });
    return { status: "failed", reason: "provider_error" };
  }
}

function getTemplate(group: TemplateGroup) {
  const suffix = group === "50plus" ? "50PLUS" : group.toUpperCase();
  return {
    code: process.env[`NEXT_PRIVATE_GONGBUEONG_AGE_${suffix}_TEMPLATE_KEY`]?.trim() || "",
    message: decodeEnvLineBreaks(
      process.env[`NEXT_PRIVATE_GONGBUEONG_AGE_${suffix}_MESSAGE`]?.trim() || "",
    ),
    title:
      process.env.NEXT_PRIVATE_GONGBUEONG_AGE_NOTIFICATION_TITLE?.trim() ||
      "공부엉이 맞춤 안내",
    targetPath:
      process.env.NEXT_PRIVATE_GONGBUEONG_AGE_NOTIFICATION_TARGET_PATH?.trim() || "/",
    buttonName:
      process.env.NEXT_PRIVATE_GONGBUEONG_AGE_NOTIFICATION_BUTTON_NAME?.trim() ||
      "공부엉이 바로가기",
  };
}

function decodeEnvLineBreaks(value: string) {
  return value.replace(/\\n/g, "\n");
}
