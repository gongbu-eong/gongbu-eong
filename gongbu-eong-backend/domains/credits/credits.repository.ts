import type { PoolClient } from "pg";
import { db } from "@/lib/db";
import { hashOAuthIdentity } from "@/domains/auth/oauth-token-crypto";
import { createCreditNotification } from "@/domains/notifications/notifications.repository";

type DbClient = Pick<PoolClient, "query">;
type OAuthProvider = "kakao" | "naver";

export const MAX_CREDIT_BALANCE = 20;
// 진단권 관련 지급/소모 로직 비활성화. 복구 시 true로 되돌리면 아래 원본 로직이 다시 실행됩니다.
const CREDIT_LOGIC_ENABLED = false;
// const CREDIT_LOGIC_ENABLED = process.env.GONGBUEONG_CREDIT_LOGIC_ENABLED === "true";

export const CREDIT_REWARD_POLICY = {
  welcomeSignup: {
    amount: 5,
    sourceType: "welcome_signup",
    reason: "신규 가입 무료 진단권 5개",
  },
  communityActivityMilestone: {
    amount: 1,
    milestoneCount: 5,
    sourceType: "community_activity_milestone",
    reason: "커뮤니티 글·댓글 활동 보상",
  },
  diagnosisResultShare: {
    amount: 1,
    sourceType: "diagnosis_result_share",
    reason: "강점·성향 진단 결과 공유 보상",
  },
} as const;

type CreditRewardPolicy = {
  amount: number;
  dailyLimit?: number;
  milestoneCount?: number;
  isActive: boolean;
  reason: string;
};

export type CreditRewardGrantResult = {
  granted: boolean;
  balanceAfter: number;
  reason?:
    | "policy_inactive"
    | "already_granted"
    | "max_balance"
    | "insert_blocked"
    | "disabled";
};

export type CommunityActivityRewardProgress = {
  activityCount: number;
  milestoneCount: number;
  currentCount: number;
  remainingCount: number;
  percent: number;
  isMaxed: boolean;
};

export async function grantWelcomeSignupCredits(
  client: DbClient,
  userId: string,
) {
  if (!CREDIT_LOGIC_ENABLED) {
    // 진단권 지급 로직 비활성화: 첫 가입 무료 진단권을 지급하지 않습니다.
    return {
      granted: false,
      balanceAfter: await getCurrentCreditBalance(userId, client),
      reason: "disabled",
    } satisfies CreditRewardGrantResult;
  }

  const policy = await getCreditRewardPolicy(
    client,
    CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
    {
      amount: CREDIT_REWARD_POLICY.welcomeSignup.amount,
      isActive: true,
      reason: CREDIT_REWARD_POLICY.welcomeSignup.reason,
    },
  );

  if (!policy.isActive) {
    return {
      granted: false,
      balanceAfter: await getCurrentCreditBalance(userId, client),
      reason: "policy_inactive",
    } satisfies CreditRewardGrantResult;
  }

  const oauthIdentities = await getUserOAuthRewardIdentities(client, userId);
  const hasPreviousOAuthReward = await hasOAuthIdentityRewardGrant(
    client,
    oauthIdentities,
    CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
  );

  if (hasPreviousOAuthReward) {
    return {
      granted: false,
      balanceAfter: await getCurrentCreditBalance(userId, client),
      reason: "already_granted",
    } satisfies CreditRewardGrantResult;
  }

  const currentBalance = await getCurrentCreditBalance(userId, client);
  if (currentBalance + policy.amount > MAX_CREDIT_BALANCE) {
    return {
      granted: false,
      balanceAfter: currentBalance,
      reason: "max_balance",
    } satisfies CreditRewardGrantResult;
  }

  const transaction = await insertCreditTransaction(client, {
    userId,
    amount: policy.amount,
    transactionType: "event_grant",
    sourceType: CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
    sourceId: userId,
    reason: policy.reason,
    metadata: { grantType: "signup", freeCredits: true },
  });

  if (transaction.granted) {
    await recordOAuthIdentityRewardGrant(client, oauthIdentities, {
      rewardKey: CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
      userId,
      creditTransactionId: transaction.id,
      sourceId: userId,
      metadata: { grantType: "signup", freeCredits: true },
    });
  }

  return {
    granted: transaction.granted,
    balanceAfter:
      transaction.balanceAfter ?? (await getCurrentCreditBalance(userId, client)),
    reason: transaction.granted ? undefined : "insert_blocked",
  } satisfies CreditRewardGrantResult;
}

export async function grantCommunityActivityMilestoneReward(
  userId: string,
  source: { type: "post" | "comment"; id: string },
) {
  if (!CREDIT_LOGIC_ENABLED) {
    // 진단권 지급 로직 비활성화: 커뮤니티 활동 보상을 지급하지 않습니다.
    void source;
    const currentBalance = await getCurrentCreditBalance(userId);
    return {
      granted: false,
      balanceAfter: currentBalance,
      progress: buildCommunityActivityRewardProgress(0, CREDIT_REWARD_POLICY.communityActivityMilestone.milestoneCount, true),
    };
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const policy = await getCreditRewardPolicy(
      client,
      CREDIT_REWARD_POLICY.communityActivityMilestone.sourceType,
      {
        amount: CREDIT_REWARD_POLICY.communityActivityMilestone.amount,
        milestoneCount:
          CREDIT_REWARD_POLICY.communityActivityMilestone.milestoneCount,
        isActive: true,
        reason: CREDIT_REWARD_POLICY.communityActivityMilestone.reason,
      },
    );

    const milestoneCount =
      policy.milestoneCount ??
      CREDIT_REWARD_POLICY.communityActivityMilestone.milestoneCount;
    const activityCount = await getCommunityActivityCount(userId, client);
    const currentBalance = await getCurrentCreditBalance(userId, client);
    const progress = buildCommunityActivityRewardProgress(
      activityCount,
      milestoneCount,
      currentBalance >= MAX_CREDIT_BALANCE,
    );

    if (!policy.isActive) {
      await client.query("COMMIT");
      return { granted: false, balanceAfter: currentBalance, progress };
    }

    if (progress.isMaxed) {
      await client.query("COMMIT");
      return { granted: false, balanceAfter: currentBalance, progress };
    }

    const isMilestoneBoundary =
      activityCount > 0 && activityCount % progress.milestoneCount === 0;
    const achievedMilestone = Math.floor(activityCount / progress.milestoneCount);

    if (!isMilestoneBoundary) {
      await client.query("COMMIT");
      return { granted: false, balanceAfter: currentBalance, progress };
    }

    const transaction = await insertCreditTransaction(client, {
      userId,
      amount: policy.amount,
      transactionType: "event_grant",
      sourceType: CREDIT_REWARD_POLICY.communityActivityMilestone.sourceType,
      sourceId: `activity:${progress.milestoneCount}:${achievedMilestone}`,
      reason: `${policy.reason} (${activityCount}번째 활동)`,
      metadata: {
        source,
        milestone: achievedMilestone,
        activityCount,
        milestoneCount: progress.milestoneCount,
      },
    });

    const balanceAfter =
      transaction.balanceAfter ?? (await getCurrentCreditBalance(userId, client));

    await client.query("COMMIT");
    return { granted: transaction.granted, balanceAfter, progress };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function grantDiagnosisResultShareReward(
  userId: string,
  resultId: string,
) {
  if (!CREDIT_LOGIC_ENABLED) {
    // 진단권 지급 로직 비활성화: 진단 결과 공유 보상을 지급하지 않습니다.
    void resultId;
    return { granted: false, balanceAfter: await getCurrentCreditBalance(userId) };
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const policy = await getCreditRewardPolicy(
      client,
      CREDIT_REWARD_POLICY.diagnosisResultShare.sourceType,
      {
        amount: CREDIT_REWARD_POLICY.diagnosisResultShare.amount,
        isActive: true,
        reason: CREDIT_REWARD_POLICY.diagnosisResultShare.reason,
      },
    );

    if (!policy.isActive) {
      const balanceAfter = await getCurrentCreditBalance(userId, client);
      await client.query("COMMIT");
      return { granted: false, balanceAfter };
    }

    const oauthIdentities = await getUserOAuthRewardIdentities(client, userId);
    const hasPreviousOAuthReward = await hasOAuthIdentityRewardGrant(
      client,
      oauthIdentities,
      CREDIT_REWARD_POLICY.diagnosisResultShare.sourceType,
    );

    const previousReward = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.credit_transactions
        WHERE user_id = $1
          AND source_type = $2::varchar(80)
        LIMIT 1
      `,
      [userId, CREDIT_REWARD_POLICY.diagnosisResultShare.sourceType],
    );

    if (hasPreviousOAuthReward || previousReward.rows[0]) {
      const balanceAfter = await getCurrentCreditBalance(userId, client);
      await client.query("COMMIT");
      return { granted: false, balanceAfter };
    }

    const transaction = await insertCreditTransaction(client, {
      userId,
      amount: policy.amount,
      transactionType: "event_grant",
      sourceType: CREDIT_REWARD_POLICY.diagnosisResultShare.sourceType,
      sourceId: userId,
      reason: policy.reason,
      metadata: { grantType: "diagnosis_result_share", resultId },
    });

    if (transaction.granted) {
      await recordOAuthIdentityRewardGrant(client, oauthIdentities, {
        rewardKey: CREDIT_REWARD_POLICY.diagnosisResultShare.sourceType,
        userId,
        creditTransactionId: transaction.id,
        sourceId: resultId,
        metadata: { grantType: "diagnosis_result_share", resultId },
      });
    }

    const balanceAfter =
      transaction.balanceAfter ?? (await getCurrentCreditBalance(userId, client));

    await client.query("COMMIT");
    return { granted: transaction.granted, balanceAfter };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeCoachingCredit(userId: string, sourceId: string) {
  if (!CREDIT_LOGIC_ENABLED) {
    // 진단권 소모 로직 비활성화: AI 코칭 시 진단권을 차감하지 않습니다.
    void sourceId;
    return { consumed: false, balanceAfter: await getCurrentCreditBalance(userId) };
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const transaction = await insertCreditTransaction(client, {
      userId,
      amount: -1,
      transactionType: "use",
      sourceType: "resume_coaching",
      sourceId,
      reason: "AI NCS 자소서 코칭 진단권 사용",
      metadata: { feature: "ai_ncs_cover_letter_coaching" },
      requireSufficientBalance: true,
    });
    const balanceAfter =
      transaction.balanceAfter ?? (await getCurrentCreditBalance(userId, client));

    await client.query("COMMIT");
    return { consumed: transaction.granted, balanceAfter };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function refundCoachingCredit(userId: string, sourceId: string) {
  if (!CREDIT_LOGIC_ENABLED) {
    // 진단권 환불 로직 비활성화: 차감이 없으므로 환불 트랜잭션도 생성하지 않습니다.
    void sourceId;
    return { refunded: false, balanceAfter: await getCurrentCreditBalance(userId) };
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const transaction = await insertCreditTransaction(client, {
      userId,
      amount: 1,
      transactionType: "refund",
      sourceType: "resume_coaching_refund",
      sourceId,
      reason: "AI NCS 자소서 코칭 실패 환불",
      metadata: { originalSourceType: "resume_coaching", originalSourceId: sourceId },
    });
    const balanceAfter =
      transaction.balanceAfter ?? (await getCurrentCreditBalance(userId, client));

    await client.query("COMMIT");
    return { refunded: transaction.granted, balanceAfter };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCurrentCreditBalance(userId: string, client: DbClient = db) {
  const result = await client.query<{ balance_after: number | null }>(
    `
      SELECT balance_after
      FROM public.credit_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId],
  );

  return Number(result.rows[0]?.balance_after || 0);
}

export async function getCommunityActivityRewardProgress(
  userId: string,
  client: DbClient = db,
) {
  const policy = await getCreditRewardPolicy(
    client,
    CREDIT_REWARD_POLICY.communityActivityMilestone.sourceType,
    {
      amount: CREDIT_REWARD_POLICY.communityActivityMilestone.amount,
      milestoneCount:
        CREDIT_REWARD_POLICY.communityActivityMilestone.milestoneCount,
      isActive: true,
      reason: CREDIT_REWARD_POLICY.communityActivityMilestone.reason,
    },
  );
  const milestoneCount =
    policy.milestoneCount ??
    CREDIT_REWARD_POLICY.communityActivityMilestone.milestoneCount;
  const activityCount = await getCommunityActivityCount(userId, client);
  const currentBalance = await getCurrentCreditBalance(userId, client);

  return buildCommunityActivityRewardProgress(
    activityCount,
    milestoneCount,
    currentBalance >= MAX_CREDIT_BALANCE,
  );
}

async function getCommunityActivityCount(userId: string, client: DbClient) {
  const result = await client.query<{ count: string }>(
    `
      SELECT (
        SELECT COUNT(*)
        FROM public.community_posts
        WHERE user_id = $1
          AND status = 'active'
      ) + (
        SELECT COUNT(*)
        FROM public.community_comments
        WHERE user_id = $1
          AND status = 'active'
      ) AS count
    `,
    [userId],
  );

  return Number(result.rows[0]?.count || 0);
}

async function getUserOAuthRewardIdentities(client: DbClient, userId: string) {
  const result = await client.query<{
    provider: OAuthProvider;
    provider_user_id: string;
  }>(
    `
      SELECT provider, provider_user_id
      FROM public.user_oauth_accounts
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    provider: row.provider,
    providerUserIdHash: hashOAuthIdentity(row.provider, row.provider_user_id),
  }));
}

async function hasOAuthIdentityRewardGrant(
  client: DbClient,
  identities: Array<{ provider: OAuthProvider; providerUserIdHash: string }>,
  rewardKey: string,
) {
  if (!identities.length) return false;

  for (const identity of identities) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `oauth-reward:${rewardKey}:${identity.provider}:${identity.providerUserIdHash}`,
    ]);
  }

  const result = await client.query<{ exists: boolean }>(
    `
      WITH reward_identities AS (
        SELECT *
        FROM unnest($1::text[], $2::text[]) AS identity(provider, provider_user_id_hash)
      )
      SELECT EXISTS (
        SELECT 1
        FROM reward_identities identity
        WHERE EXISTS (
          SELECT 1
          FROM public.oauth_identity_reward_grants grants
          WHERE grants.provider = identity.provider::public.oauth_provider
            AND grants.provider_user_id_hash = identity.provider_user_id_hash
            AND grants.reward_key = $3
        )
        OR EXISTS (
          SELECT 1
          FROM public.withdrawn_oauth_identities withdrawn
          JOIN public.credit_transactions transactions
            ON transactions.user_id = withdrawn.withdrawn_user_id
           AND transactions.source_type = $3
           AND transactions.transaction_type = 'event_grant'
           AND transactions.amount > 0
          WHERE withdrawn.provider = identity.provider::public.oauth_provider
            AND withdrawn.provider_user_id_hash = identity.provider_user_id_hash
        )
        OR (
          $3 = 'welcome_signup'
          AND EXISTS (
            SELECT 1
            FROM public.withdrawn_oauth_identities withdrawn
            WHERE withdrawn.provider = identity.provider::public.oauth_provider
              AND withdrawn.provider_user_id_hash = identity.provider_user_id_hash
          )
        )
      ) AS exists
    `,
    [
      identities.map((identity) => identity.provider),
      identities.map((identity) => identity.providerUserIdHash),
      rewardKey,
    ],
  );

  return Boolean(result.rows[0]?.exists);
}

async function recordOAuthIdentityRewardGrant(
  client: DbClient,
  identities: Array<{ provider: OAuthProvider; providerUserIdHash: string }>,
  args: {
    rewardKey: string;
    userId: string;
    creditTransactionId?: string;
    sourceId: string;
    metadata: Record<string, unknown>;
  },
) {
  if (!identities.length) return;

  await client.query(
    `
      INSERT INTO public.oauth_identity_reward_grants (
        provider,
        provider_user_id_hash,
        reward_key,
        user_id,
        credit_transaction_id,
        source_id,
        metadata,
        granted_at,
        updated_at
      )
      SELECT
        identity.provider::public.oauth_provider,
        identity.provider_user_id_hash,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        NOW(),
        NOW()
      FROM unnest($1::text[], $2::text[]) AS identity(provider, provider_user_id_hash)
      ON CONFLICT (provider, provider_user_id_hash, reward_key) DO NOTHING
    `,
    [
      identities.map((identity) => identity.provider),
      identities.map((identity) => identity.providerUserIdHash),
      args.rewardKey,
      args.userId,
      args.creditTransactionId || null,
      args.sourceId,
      JSON.stringify(args.metadata),
    ],
  );
}

function buildCommunityActivityRewardProgress(
  activityCount: number,
  milestoneCount: number,
  isMaxed = false,
) {
  const safeMilestoneCount = Math.max(1, milestoneCount);
  if (isMaxed) {
    return {
      activityCount,
      milestoneCount: safeMilestoneCount,
      currentCount: 0,
      remainingCount: 0,
      percent: 0,
      isMaxed: true,
    } satisfies CommunityActivityRewardProgress;
  }

  const currentCount = activityCount % safeMilestoneCount;
  const remainingCount =
    currentCount === 0 ? safeMilestoneCount : safeMilestoneCount - currentCount;

  return {
    activityCount,
    milestoneCount: safeMilestoneCount,
    currentCount,
    remainingCount,
    percent: Math.round((currentCount / safeMilestoneCount) * 100),
    isMaxed: false,
  } satisfies CommunityActivityRewardProgress;
}

async function getCreditRewardPolicy(
  client: DbClient,
  rewardKey: string,
  fallback: CreditRewardPolicy,
) {
  const result = await client.query<{
    description: string;
    credit_amount: number;
    daily_limit: number | null;
    milestone_count: number | null;
    is_active: boolean;
  }>(
    `
      SELECT
        description,
        credit_amount,
        daily_limit,
        milestone_count,
        is_active
      FROM public.credit_reward_policies
      WHERE reward_key = $1
      LIMIT 1
    `,
    [rewardKey],
  );
  const row = result.rows[0];

  if (!row) return fallback;

  return {
    amount: Number(row.credit_amount) || fallback.amount,
    dailyLimit: row.daily_limit ?? fallback.dailyLimit,
    milestoneCount: row.milestone_count ?? fallback.milestoneCount,
    isActive: row.is_active,
    reason: row.description || fallback.reason,
  } satisfies CreditRewardPolicy;
}

async function insertCreditTransaction(
  client: DbClient,
  args: {
    userId: string;
    amount: number;
    transactionType: "purchase" | "use" | "refund" | "admin_adjust" | "event_grant";
    sourceType: string;
    sourceId: string;
    reason: string;
    metadata: Record<string, unknown>;
    requireSufficientBalance?: boolean;
  },
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `credit:${args.userId}`,
  ]);

  const result = await client.query<{ id: string; balance_after: number }>(
    `
      WITH current_balance AS (
        SELECT COALESCE((
          SELECT balance_after
          FROM public.credit_transactions
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        ), 0) AS balance
      )
      INSERT INTO public.credit_transactions (
        user_id,
        transaction_type,
        amount,
        balance_after,
        reason,
        source_type,
        source_id,
        metadata
      )
      SELECT
        $1,
        $7::public.credit_transaction_type,
        $2,
        current_balance.balance + $2,
        $3,
        $4::varchar(80),
        $5::text,
        $6::jsonb
      FROM current_balance
      WHERE ($8::boolean = false OR current_balance.balance + $2 >= 0)
        AND ($2 <= 0 OR current_balance.balance + $2 <= $9::integer)
        AND NOT EXISTS (
        SELECT 1
        FROM public.credit_transactions
        WHERE user_id = $1
          AND source_type = $4::varchar(80)
          AND source_id = $5::text
      )
      RETURNING id, balance_after
    `,
    [
      args.userId,
      args.amount,
      args.reason,
      args.sourceType,
      args.sourceId,
      JSON.stringify(args.metadata),
      args.transactionType,
      Boolean(args.requireSufficientBalance),
      MAX_CREDIT_BALANCE,
    ],
  );

  const row = result.rows[0];

  if (row) {
    await createCreditNotification(client, {
      userId: args.userId,
      transactionId: row.id,
      amount: args.amount,
      transactionType: args.transactionType,
      reason: args.reason,
      balanceAfter: row.balance_after,
    });
  }

  return { id: row?.id, granted: Boolean(row), balanceAfter: row?.balance_after };
}
