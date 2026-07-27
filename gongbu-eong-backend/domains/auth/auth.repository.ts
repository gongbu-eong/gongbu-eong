import { db } from "@/lib/db";

type OAuthProvider = "kakao" | "naver";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  nickname?: string;
};

export async function upsertOAuthUser(args: {
  profile: OAuthProfile;
  accessTokenHash?: string;
  refreshTokenHash?: string;
  tokenExpiresAt?: Date;
  sessionTokenHash: string;
  entrySource: string;
  diagnosisRunId?: string;
  anonymousId?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const existingAccount = await client.query<{ user_id: string }>(
      `
        SELECT user_id
        FROM public.user_oauth_accounts
        WHERE provider = $1::public.oauth_provider
          AND provider_user_id = $2
        LIMIT 1
      `,
      [args.profile.provider, args.profile.providerUserId],
    );

    let userId = existingAccount.rows[0]?.user_id;

    if (!userId) {
      const user = await client.query<{ id: string }>(
        `
          INSERT INTO public.users (email, nickname, display_name, last_login_at)
          VALUES ($1, $2, $2, NOW())
          ON CONFLICT (email) DO UPDATE SET
            nickname = COALESCE(public.users.nickname, EXCLUDED.nickname),
            display_name = COALESCE(public.users.display_name, EXCLUDED.display_name),
            last_login_at = NOW(),
            updated_at = NOW()
          RETURNING id
        `,
        [args.profile.email || null, args.profile.nickname || null],
      );
      userId = user.rows[0].id;

      await client.query(
        `
          INSERT INTO public.user_oauth_accounts (
            user_id,
            provider,
            provider_user_id,
            provider_email,
            provider_nickname,
            access_token_hash,
            refresh_token_hash,
            token_expires_at,
            last_used_at
          )
          VALUES ($1, $2::public.oauth_provider, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (provider, provider_user_id) DO UPDATE SET
            access_token_hash = EXCLUDED.access_token_hash,
            refresh_token_hash = EXCLUDED.refresh_token_hash,
            token_expires_at = EXCLUDED.token_expires_at,
            last_used_at = NOW(),
            updated_at = NOW()
        `,
        [
          userId,
          args.profile.provider,
          args.profile.providerUserId,
          args.profile.email || null,
          args.profile.nickname || null,
          args.accessTokenHash || null,
          args.refreshTokenHash || null,
          args.tokenExpiresAt || null,
        ],
      );
    } else {
      await client.query(
        `
          UPDATE public.users
          SET last_login_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `,
        [userId],
      );

      await client.query(
        `
          UPDATE public.user_oauth_accounts
          SET
            provider_email = $3,
            provider_nickname = $4,
            access_token_hash = $5,
            refresh_token_hash = $6,
            token_expires_at = $7,
            last_used_at = NOW(),
            updated_at = NOW()
          WHERE provider = $1::public.oauth_provider
            AND provider_user_id = $2
        `,
        [
          args.profile.provider,
          args.profile.providerUserId,
          args.profile.email || null,
          args.profile.nickname || null,
          args.accessTokenHash || null,
          args.refreshTokenHash || null,
          args.tokenExpiresAt || null,
        ],
      );
    }

    await client.query(
      `
        INSERT INTO public.user_sessions (
          user_id,
          session_token_hash,
          ip_address,
          user_agent,
          expires_at
        )
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '14 days')
      `,
      [
        userId,
        args.sessionTokenHash,
        args.ipAddress || null,
        args.userAgent || null,
      ],
    );

    await client.query(
      `
        INSERT INTO public.auth_login_events (
          user_id,
          provider,
          success,
          entry_source,
          ip_address,
          user_agent
        )
        VALUES ($1, $2::public.oauth_provider, TRUE, $3::public.entry_source, $4, $5)
      `,
      [
        userId,
        args.profile.provider,
        args.entrySource,
        args.ipAddress || null,
        args.userAgent || null,
      ],
    );

    if (args.diagnosisRunId) {
      await client.query(
        `
          INSERT INTO public.diagnosis_login_conversions (
            diagnosis_run_id,
            diagnosis_result_id,
            user_id,
            provider,
            anonymous_id,
            entry_source,
            ip_address,
            user_agent
          )
          SELECT
            $1,
            diagnosis_results.id,
            $2,
            $3::public.oauth_provider,
            $4,
            $5::public.entry_source,
            $6,
            $7
          FROM public.diagnosis_runs
          LEFT JOIN public.diagnosis_results
            ON diagnosis_results.diagnosis_run_id = diagnosis_runs.id
          WHERE diagnosis_runs.id = $1
          ON CONFLICT (diagnosis_run_id, user_id, provider) DO NOTHING
        `,
        [
          args.diagnosisRunId,
          userId,
          args.profile.provider,
          args.anonymousId || null,
          args.entrySource,
          args.ipAddress || null,
          args.userAgent || null,
        ],
      );
    }

    await client.query("COMMIT");

    return { userId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
