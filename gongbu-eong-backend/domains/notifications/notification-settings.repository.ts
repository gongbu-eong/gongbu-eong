import { db } from "@/lib/db";
import {
  SIGNUP_AGREEMENT_VERSION,
  SIGNUP_CONSENT_KEYS,
} from "@/domains/auth/signup-consents";

export const DEADLINE_NOTIFICATION_OFFSETS = [7, 3, 0] as const;

export type DeadlineNotificationOffset =
  (typeof DEADLINE_NOTIFICATION_OFFSETS)[number];

export type NotificationSettings = {
  phoneNumber: string | null;
  kakaoConnected: boolean;
  kakaoConnectedAt: string | null;
  deadlineEnabled: boolean;
  deadlineOffsets: DeadlineNotificationOffset[];
  marketingAgreed: boolean;
  marketingAgreedAt: string | null;
  marketingRevokedAt: string | null;
};

export type UpdateNotificationSettingsInput = {
  phoneNumber: string | null;
  kakaoConnected: boolean;
  deadlineEnabled: boolean;
  deadlineOffsets: DeadlineNotificationOffset[];
  marketingAgreed: boolean;
  ipAddress?: string;
  userAgent?: string;
};

type NotificationSettingsRow = {
  phone: string | null;
  kakao_enabled: boolean | null;
  kakao_connected_at: Date | string | null;
  application_deadline_enabled: boolean | null;
  application_deadline_days_before: number | null;
  application_deadline_days_before_list: number[] | null;
  marketing_enabled: boolean | null;
  marketing_consent_agreed: boolean | null;
  marketing_consent_updated_at: Date | string | null;
  marketing_agreed_at: Date | string | null;
  marketing_revoked_at: Date | string | null;
};

export async function findNotificationSettings(userId: string) {
  await ensureNotificationPreferences(userId);

  const result = await db.query<NotificationSettingsRow>(
    `
      SELECT
        users.phone,
        preferences.kakao_enabled,
        preferences.kakao_connected_at,
        preferences.application_deadline_enabled,
        preferences.application_deadline_days_before,
        preferences.application_deadline_days_before_list,
        preferences.marketing_enabled,
        marketing_consent.agreed AS marketing_consent_agreed,
        marketing_consent.updated_at AS marketing_consent_updated_at,
        preferences.marketing_agreed_at,
        preferences.marketing_revoked_at
      FROM public.users users
      LEFT JOIN public.notification_preferences preferences
        ON preferences.user_id = users.id
      LEFT JOIN LATERAL (
        SELECT agreed, updated_at
        FROM public.user_consents consents
        WHERE consents.user_id = users.id
          AND consents.terms_key = $2
        ORDER BY consents.created_at DESC, consents.id DESC
        LIMIT 1
      ) marketing_consent ON TRUE
      WHERE users.id = $1
        AND users.status = 'active'
      LIMIT 1
    `,
    [userId, SIGNUP_CONSENT_KEYS.marketingNotifications],
  );

  return result.rows[0] ? toNotificationSettings(result.rows[0]) : null;
}

export async function updateNotificationSettings(
  userId: string,
  input: UpdateNotificationSettingsInput,
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query<NotificationSettingsRow>(
      `
        SELECT
          users.phone,
          preferences.kakao_enabled,
          preferences.kakao_connected_at,
          preferences.application_deadline_enabled,
          preferences.application_deadline_days_before,
          preferences.application_deadline_days_before_list,
          preferences.marketing_enabled,
          marketing_consent.agreed AS marketing_consent_agreed,
          marketing_consent.updated_at AS marketing_consent_updated_at,
          preferences.marketing_agreed_at,
          preferences.marketing_revoked_at
        FROM public.users users
        LEFT JOIN public.notification_preferences preferences
          ON preferences.user_id = users.id
        LEFT JOIN LATERAL (
          SELECT agreed, updated_at
          FROM public.user_consents consents
          WHERE consents.user_id = users.id
            AND consents.terms_key = $2
          ORDER BY consents.created_at DESC, consents.id DESC
          LIMIT 1
        ) marketing_consent ON TRUE
        WHERE users.id = $1
          AND users.status = 'active'
        LIMIT 1
      `,
      [userId, SIGNUP_CONSENT_KEYS.marketingNotifications],
    );

    if (!currentResult.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const current = toNotificationSettings(currentResult.rows[0]);
    const deadlineOffsets = input.deadlineOffsets.length
      ? input.deadlineOffsets
      : ([3] as DeadlineNotificationOffset[]);
    const primaryDaysBefore = deadlineOffsets.includes(3)
      ? 3
      : deadlineOffsets[0];
    const nextMarketingAgreedAt =
      input.marketingAgreed && !current.marketingAgreed ? new Date() : null;
    const nextMarketingRevokedAt =
      !input.marketingAgreed && current.marketingAgreed ? new Date() : null;

    await client.query(
      `
        UPDATE public.users
        SET phone = $2,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'active'
      `,
      [userId, input.phoneNumber],
    );

    await client.query(
      `
        INSERT INTO public.notification_preferences (
          user_id,
          application_deadline_enabled,
          application_deadline_days_before,
          application_deadline_days_before_list,
          marketing_enabled,
          marketing_agreed_at,
          marketing_revoked_at,
          kakao_enabled,
          kakao_connected_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4::integer[], $5,
          $6::timestamptz,
          CASE WHEN $5::boolean THEN NULL ELSE $7::timestamptz END,
          $8,
          CASE WHEN $8::boolean THEN NOW() ELSE NULL END,
          NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          application_deadline_enabled = EXCLUDED.application_deadline_enabled,
          application_deadline_days_before = EXCLUDED.application_deadline_days_before,
          application_deadline_days_before_list = EXCLUDED.application_deadline_days_before_list,
          marketing_enabled = EXCLUDED.marketing_enabled,
          marketing_agreed_at = CASE
            WHEN EXCLUDED.marketing_enabled
              THEN COALESCE($6::timestamptz, public.notification_preferences.marketing_agreed_at, NOW())
            ELSE public.notification_preferences.marketing_agreed_at
          END,
          marketing_revoked_at = CASE
            WHEN EXCLUDED.marketing_enabled THEN NULL
            ELSE COALESCE($7::timestamptz, public.notification_preferences.marketing_revoked_at)
          END,
          kakao_enabled = EXCLUDED.kakao_enabled,
          kakao_connected_at = COALESCE(
            public.notification_preferences.kakao_connected_at,
            CASE WHEN $8::boolean THEN NOW() ELSE NULL END
          ),
          updated_at = NOW()
      `,
      [
        userId,
        input.deadlineEnabled,
        primaryDaysBefore,
        deadlineOffsets,
        input.marketingAgreed,
        nextMarketingAgreedAt,
        nextMarketingRevokedAt,
        input.kakaoConnected,
      ],
    );

    await client.query(
      `
        INSERT INTO public.user_consents (
          user_id,
          terms_key,
          terms_version,
          agreed,
          ip_address,
          user_agent,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (user_id, terms_key, terms_version)
        DO UPDATE SET
          agreed = EXCLUDED.agreed,
          ip_address = CASE
            WHEN public.user_consents.agreed IS DISTINCT FROM EXCLUDED.agreed
            THEN EXCLUDED.ip_address
            ELSE public.user_consents.ip_address
          END,
          user_agent = CASE
            WHEN public.user_consents.agreed IS DISTINCT FROM EXCLUDED.agreed
            THEN EXCLUDED.user_agent
            ELSE public.user_consents.user_agent
          END,
          updated_at = CASE
            WHEN public.user_consents.agreed IS DISTINCT FROM EXCLUDED.agreed
            THEN NOW()
            ELSE public.user_consents.updated_at
          END
      `,
      [
        userId,
        SIGNUP_CONSENT_KEYS.marketingNotifications,
        SIGNUP_AGREEMENT_VERSION,
        input.marketingAgreed,
        input.ipAddress || null,
        input.userAgent || null,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return findNotificationSettings(userId);
}

async function ensureNotificationPreferences(userId: string) {
  await db.query(
    `
      INSERT INTO public.notification_preferences (
        user_id,
        application_deadline_enabled,
        application_deadline_days_before,
        application_deadline_days_before_list,
        marketing_enabled,
        kakao_enabled,
        updated_at
      )
      VALUES ($1, true, 3, ARRAY[3]::integer[], false, false, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );
}

function toNotificationSettings(
  row: NotificationSettingsRow,
): NotificationSettings {
  const offsetValues =
    row.application_deadline_days_before_list?.length
      ? row.application_deadline_days_before_list
      : [row.application_deadline_days_before ?? 3];
  const deadlineOffsets = offsetValues
    .filter((value): value is DeadlineNotificationOffset =>
      DEADLINE_NOTIFICATION_OFFSETS.includes(
        value as DeadlineNotificationOffset,
      ),
    )
    .filter((value, index, values) => values.indexOf(value) === index);
  const marketingAgreed = Boolean(
    row.marketing_consent_agreed ?? row.marketing_enabled,
  );

  return {
    phoneNumber: row.phone,
    kakaoConnected: Boolean(row.kakao_enabled),
    kakaoConnectedAt: toIso(row.kakao_connected_at),
    deadlineEnabled: row.application_deadline_enabled ?? true,
    deadlineOffsets: deadlineOffsets.length ? deadlineOffsets : [3],
    marketingAgreed,
    marketingAgreedAt: marketingAgreed
      ? toIso(row.marketing_consent_updated_at ?? row.marketing_agreed_at)
      : toIso(row.marketing_agreed_at),
    marketingRevokedAt: marketingAgreed
      ? null
      : toIso(row.marketing_consent_updated_at ?? row.marketing_revoked_at),
  };
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
