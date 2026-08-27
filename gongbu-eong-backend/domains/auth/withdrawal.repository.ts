import { db } from "@/lib/db";
import { hashOAuthIdentity } from "./oauth-token-crypto";

type OAuthProvider = "kakao" | "naver";

export const WITHDRAWAL_REASON_CODES = [
  "content_lack",
  "low_usage",
  "privacy_concern",
  "inconvenient",
  "other",
] as const;

export type WithdrawalReasonCode = (typeof WITHDRAWAL_REASON_CODES)[number];

export type WithdrawalOAuthAccount = {
  provider: OAuthProvider;
  providerUserId: string;
  providerEmail: string | null;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
};

export type ExternalUnlinkResult = {
  provider: OAuthProvider;
  status: "succeeded" | "failed" | "skipped";
  message?: string;
};

export async function findOAuthAccountsForWithdrawal(userId: string) {
  const result = await db.query<{
    provider: OAuthProvider;
    provider_user_id: string;
    provider_email: string | null;
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
  }>(
    `
      SELECT
        provider,
        provider_user_id,
        provider_email,
        access_token_encrypted,
        refresh_token_encrypted
      FROM public.user_oauth_accounts
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    provider: row.provider,
    providerUserId: row.provider_user_id,
    providerEmail: row.provider_email,
    accessTokenEncrypted: row.access_token_encrypted,
    refreshTokenEncrypted: row.refresh_token_encrypted,
  }));
}

export async function withdrawUserAccount(args: {
  userId: string;
  sessionTokenHash?: string;
  reasonCode: WithdrawalReasonCode;
  reasonDetail?: string | null;
  noticeAgreed: boolean;
  ipAddress?: string;
  userAgent?: string;
  oauthAccounts: WithdrawalOAuthAccount[];
  externalUnlinkResults: ExternalUnlinkResult[];
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const user = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.users
        WHERE id = $1
          AND status = 'active'
        FOR UPDATE
      `,
      [args.userId],
    );

    if (!user.rows[0]) {
      throw badRequest("이미 탈퇴했거나 사용할 수 없는 계정입니다.");
    }

    const withdrawalRequest = await client.query<{
      id: string;
      private_data_purge_after: Date;
    }>(
      `
        INSERT INTO public.user_withdrawal_requests (
          user_id,
          reason_code,
          reason_detail,
          notice_agreed,
          notice_agreed_at,
          oauth_unlink_results,
          private_data_purge_after,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, $3, $4, NOW(), $5::jsonb, NOW() + INTERVAL '30 days', $6, $7)
        RETURNING id, private_data_purge_after
      `,
      [
        args.userId,
        args.reasonCode,
        args.reasonDetail || null,
        args.noticeAgreed,
        JSON.stringify(args.externalUnlinkResults),
        args.ipAddress || null,
        args.userAgent || null,
      ],
    );
    const withdrawalRequestId = withdrawalRequest.rows[0].id;
    const privateDataPurgeAfter =
      withdrawalRequest.rows[0].private_data_purge_after;

    await client.query(
      `
        INSERT INTO public.user_withdrawal_retained_profiles (
          withdrawal_request_id,
          user_id,
          email,
          nickname,
          display_name,
          community_nickname,
          phone,
          avatar_url,
          profile_status_message,
          profile_avatar_key,
          profile_background_color,
          gender,
          age_group,
          selected_diagnosis_result_id,
          selected_resume_id,
          oauth_account_snapshot,
          purge_after
        )
        SELECT
          $2,
          users.id,
          users.email,
          users.nickname,
          users.display_name,
          users.community_nickname,
          users.phone,
          users.avatar_url,
          users.profile_status_message,
          users.profile_avatar_key,
          users.profile_background_color,
          users.gender,
          users.age_group,
          users.selected_diagnosis_result_id,
          users.selected_resume_id,
          $3::jsonb,
          $4
        FROM public.users users
        WHERE users.id = $1
        ON CONFLICT (withdrawal_request_id) DO NOTHING
      `,
      [
        args.userId,
        withdrawalRequestId,
        JSON.stringify(
          args.oauthAccounts.map((account) => ({
            provider: account.provider,
            providerEmail: account.providerEmail,
          })),
        ),
        privateDataPurgeAfter,
      ],
    );

    for (const account of args.oauthAccounts) {
      await client.query(
        `
          INSERT INTO public.withdrawn_oauth_identities (
            provider,
            provider_user_id_hash,
            provider_email_hash,
            withdrawn_user_id,
            withdrawn_at,
            first_withdrawn_at,
            last_withdrawal_request_id,
            withdrawal_count,
            retain_until,
            welcome_credit_blocked_until
          )
          VALUES ($1::public.oauth_provider, $2, $3, $4, NOW(), NOW(), $5, 1, $6, $6)
          ON CONFLICT (provider, provider_user_id_hash) DO UPDATE SET
            provider_email_hash = EXCLUDED.provider_email_hash,
            withdrawn_user_id = EXCLUDED.withdrawn_user_id,
            withdrawn_at = EXCLUDED.withdrawn_at,
            last_withdrawal_request_id = EXCLUDED.last_withdrawal_request_id,
            withdrawal_count = public.withdrawn_oauth_identities.withdrawal_count + 1,
            retain_until = EXCLUDED.retain_until,
            welcome_credit_blocked_until = EXCLUDED.welcome_credit_blocked_until,
            updated_at = NOW()
        `,
        [
          account.provider,
          hashOAuthIdentity(account.provider, account.providerUserId),
          account.providerEmail
            ? hashOAuthIdentity(account.provider, account.providerEmail)
            : null,
          args.userId,
          withdrawalRequestId,
          privateDataPurgeAfter,
        ],
      );
    }

    await client.query(
      `
        UPDATE public.users
        SET
          email = NULL,
          nickname = '탈퇴한 사용자',
          display_name = '탈퇴한 사용자',
          community_nickname = '탈퇴한 사용자',
          phone = NULL,
          avatar_url = NULL,
          profile_status_message = NULL,
          profile_avatar_key = 'fox',
          profile_background_color = '#c4c6ca',
          gender = NULL,
          age_group = NULL,
          selected_diagnosis_result_id = NULL,
          selected_resume_id = NULL,
          status = 'withdrawn',
          withdrawn_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [args.userId],
    );

    await client.query(
      `
        DELETE FROM public.user_oauth_accounts
        WHERE user_id = $1
      `,
      [args.userId],
    );

    if (args.sessionTokenHash) {
      await client.query(
        `
          DELETE FROM public.user_sessions
          WHERE session_token_hash = $1
        `,
        [args.sessionTokenHash],
      );
    }

    await client.query(
      `
        DELETE FROM public.user_sessions
        WHERE user_id = $1
      `,
      [args.userId],
    );

    await client.query("COMMIT");
    return {
      withdrawalRequestId,
      privateDataPurgeAfter,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function hasRecentWithdrawalIdentity(
  provider: OAuthProvider,
  providerUserId: string,
) {
  const result = await db.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.withdrawn_oauth_identities
        WHERE provider = $1::public.oauth_provider
          AND provider_user_id_hash = $2
          AND welcome_credit_blocked_until > NOW()
      ) AS exists
    `,
    [provider, hashOAuthIdentity(provider, providerUserId)],
  );

  return Boolean(result.rows[0]?.exists);
}

function badRequest(message: string) {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
}
