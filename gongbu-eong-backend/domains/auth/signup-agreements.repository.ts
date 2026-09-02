import { db } from "@/lib/db";
import { grantWelcomeSignupCredits } from "@/domains/credits/credits.repository";
import {
  SIGNUP_AGREEMENT_VERSION,
  SIGNUP_CONSENT_KEYS,
} from "./signup-consents";

export type CompleteSignupAgreementsInput = {
  serviceTermsAgreed: boolean;
  privacyCollectionAgreed: boolean;
  ageOver14Agreed: boolean;
  marketingAgreed: boolean;
  ipAddress?: string;
  userAgent?: string;
};

export async function completeSignupAgreements(
  userId: string,
  input: CompleteSignupAgreementsInput,
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<{
      id: string;
      signup_completed_at: Date | string | null;
    }>(
      `
        SELECT id, signup_completed_at
        FROM public.users
        WHERE id = $1
          AND status IN ('active', 'pending_signup')
        LIMIT 1
        FOR UPDATE
      `,
      [userId],
    );

    if (!userResult.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const consents = [
      [SIGNUP_CONSENT_KEYS.ageOver14, input.ageOver14Agreed],
      [SIGNUP_CONSENT_KEYS.serviceTerms, input.serviceTermsAgreed],
      [SIGNUP_CONSENT_KEYS.privacyCollection, input.privacyCollectionAgreed],
      [SIGNUP_CONSENT_KEYS.marketingNotifications, input.marketingAgreed],
    ] as const;

    for (const [termsKey, agreed] of consents) {
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
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent,
            updated_at = NOW()
        `,
        [
          userId,
          termsKey,
          SIGNUP_AGREEMENT_VERSION,
          agreed,
          input.ipAddress || null,
          input.userAgent || null,
        ],
      );
    }

    await client.query(
      `
        UPDATE public.users
        SET
          status = 'active',
          signup_completed_at = COALESCE(signup_completed_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
      `,
      [userId],
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
          updated_at
        )
        VALUES (
          $1,
          TRUE,
          3,
          ARRAY[3]::integer[],
          $2,
          CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
          CASE WHEN $2::boolean THEN NULL ELSE NOW() END,
          FALSE,
          NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          marketing_enabled = EXCLUDED.marketing_enabled,
          marketing_agreed_at = CASE
            WHEN EXCLUDED.marketing_enabled THEN COALESCE(public.notification_preferences.marketing_agreed_at, NOW())
            ELSE public.notification_preferences.marketing_agreed_at
          END,
          marketing_revoked_at = CASE
            WHEN EXCLUDED.marketing_enabled THEN NULL
            ELSE COALESCE(public.notification_preferences.marketing_revoked_at, NOW())
          END,
          updated_at = NOW()
      `,
      [userId, input.marketingAgreed],
    );

    const shouldGrantWelcomeCredits = !userResult.rows[0].signup_completed_at;
    const welcomeCredits = shouldGrantWelcomeCredits
      ? await grantWelcomeSignupCredits(client, userId)
      : {
          granted: false,
          balanceAfter: 0,
          reason: "already_completed" as const,
        };

    await client.query("COMMIT");
    return {
      welcomeCreditsGranted: welcomeCredits.granted,
      welcomeCreditsBalanceAfter: welcomeCredits.balanceAfter,
      welcomeCreditsGrantReason: welcomeCredits.reason,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
