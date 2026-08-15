import { db } from "@/lib/db";
import { grantWelcomeSignupCredits } from "@/domains/credits/credits.repository";

type OAuthProvider = "kakao" | "naver";

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
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
    let isNewUser = false;

    if (!userId) {
      const user = await client.query<{ id: string; inserted: boolean }>(
        `
          INSERT INTO public.users (
            email,
            nickname,
            display_name,
            avatar_url,
            last_login_at
          )
          VALUES ($1, $2, $2, $3, NOW())
          ON CONFLICT (email) DO UPDATE SET
            nickname = COALESCE(EXCLUDED.nickname, public.users.nickname),
            display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
            last_login_at = NOW(),
            updated_at = NOW()
          RETURNING id, (xmax = 0) AS inserted
        `,
        [
          args.profile.email || null,
          args.profile.nickname || null,
          args.profile.avatarUrl || null,
        ],
      );
      userId = user.rows[0].id;
      isNewUser = Boolean(user.rows[0].inserted);

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

      if (isNewUser) {
        await grantWelcomeSignupCredits(client, userId);
      }
    } else {
      await client.query(
        `
          UPDATE public.users
          SET
            email = COALESCE($2, email),
            nickname = COALESCE($3, nickname),
            display_name = COALESCE($3, display_name),
            avatar_url = COALESCE($4, avatar_url),
            last_login_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          userId,
          args.profile.email || null,
          args.profile.nickname || null,
          args.profile.avatarUrl || null,
        ],
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
          UPDATE public.diagnosis_runs
          SET user_id = $2
          WHERE id = $1
            AND (user_id IS NULL OR user_id = $2)
            AND ($3::uuid IS NULL OR anonymous_id = $3::uuid)
        `,
        [
          args.diagnosisRunId,
          userId,
          args.anonymousId || null,
        ],
      );

      await client.query(
        `
          UPDATE public.diagnosis_results results
          SET user_id = $2
          FROM public.diagnosis_runs runs
          WHERE runs.id = $1
            AND results.diagnosis_run_id = runs.id
            AND runs.user_id = $2
        `,
        [args.diagnosisRunId, userId],
      );

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
            AND diagnosis_runs.user_id = $2
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

      await client.query(
        `
          UPDATE public.users users
          SET
            selected_diagnosis_result_id = diagnosis_results.id,
            updated_at = NOW()
          FROM public.diagnosis_results diagnosis_results
          WHERE users.id = $2
            AND diagnosis_results.diagnosis_run_id = $1
            AND diagnosis_results.user_id = $2
        `,
        [args.diagnosisRunId, userId],
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

export async function findUserBySessionTokenHash(sessionTokenHash: string) {
  const result = await db.query<{
    id: string;
    email: string | null;
    nickname: string | null;
    display_name: string | null;
    avatar_url: string | null;
    community_nickname: string | null;
    profile_status_message: string | null;
    profile_avatar_key: string | null;
    profile_background_color: string | null;
    gender: string | null;
    age_group: string | null;
    provider: OAuthProvider | null;
    diagnosis_type_code: string | null;
    diagnosis_type_name: string | null;
    diagnosis_run_id: string | null;
    diagnosis_result_id: string | null;
    credit_balance: number | null;
    unread_notification_count: string | number;
  }>(
    `
      SELECT
        users.id,
        users.email,
        users.nickname,
        users.display_name,
        users.avatar_url,
        users.community_nickname,
        users.profile_status_message,
        users.profile_avatar_key,
        users.profile_background_color,
        users.gender,
        users.age_group,
        oauth.provider,
        diagnosis.personality_type_code AS diagnosis_type_code,
        diagnosis.personality_type_name AS diagnosis_type_name,
        diagnosis.diagnosis_run_id,
        diagnosis.diagnosis_result_id,
        credits.balance_after AS credit_balance,
        COALESCE(notifications.unread_count, 0)::text AS unread_notification_count
      FROM public.user_sessions sessions
      JOIN public.users users
        ON users.id = sessions.user_id
      LEFT JOIN LATERAL (
        SELECT provider
        FROM public.user_oauth_accounts
        WHERE user_id = users.id
        ORDER BY last_used_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      ) oauth ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          personality_types.code AS personality_type_code,
          personality_types.name AS personality_type_name,
          runs.id AS diagnosis_run_id,
          results.id AS diagnosis_result_id
        FROM public.diagnosis_results results
        JOIN public.diagnosis_runs runs
          ON runs.id = results.diagnosis_run_id
        JOIN public.personality_types personality_types
          ON personality_types.id = results.personality_type_id
        WHERE results.user_id = users.id
           OR runs.user_id = users.id
           OR EXISTS (
             SELECT 1
             FROM public.diagnosis_login_conversions conversions
             WHERE conversions.diagnosis_result_id = results.id
               AND conversions.user_id = users.id
           )
        ORDER BY
          (results.id = users.selected_diagnosis_result_id) DESC,
          runs.completed_at DESC NULLS LAST,
          results.created_at DESC,
          results.id DESC
        LIMIT 1
      ) diagnosis ON TRUE
      LEFT JOIN LATERAL (
        SELECT balance_after
        FROM public.credit_transactions
        WHERE user_id = users.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) credits ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count
        FROM public.notifications
        WHERE user_id = users.id
          AND read_at IS NULL
      ) notifications ON TRUE
      WHERE sessions.session_token_hash = $1
        AND sessions.expires_at > NOW()
        AND users.status = 'active'
      ORDER BY sessions.created_at DESC
      LIMIT 1
    `,
    [sessionTokenHash],
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    communityNickname: user.community_nickname,
    profileStatusMessage: user.profile_status_message,
    profileAvatarKey: user.profile_avatar_key,
    profileBackgroundColor: user.profile_background_color,
    gender: user.gender,
    ageGroup: user.age_group,
    provider: user.provider,
    diagnosisTypeCode: user.diagnosis_type_code,
    diagnosisTypeName: user.diagnosis_type_name,
    diagnosisRunId: user.diagnosis_run_id,
    diagnosisResultId: user.diagnosis_result_id,
    creditBalance: Number(user.credit_balance || 0),
    unreadNotificationCount: Number(user.unread_notification_count || 0),
  };
}

export async function deleteSessionByTokenHash(sessionTokenHash: string) {
  await db.query(
    `
      DELETE FROM public.user_sessions
      WHERE session_token_hash = $1
    `,
    [sessionTokenHash],
  );
}
