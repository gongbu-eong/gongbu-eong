import type { PoolClient } from "pg";
import { db } from "@/lib/db";

type DbClient = Pick<PoolClient, "query">;

export const MAX_CREDIT_BALANCE = 20;

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
  const policy = await getCreditRewardPolicy(
    client,
    CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
    {
      amount: CREDIT_REWARD_POLICY.welcomeSignup.amount,
      isActive: true,
      reason: CREDIT_REWARD_POLICY.welcomeSignup.reason,
    },
  );

  if (!policy.isActive) return false;

  const transaction = await insertCreditTransaction(client, {
    userId,
    amount: policy.amount,
    transactionType: "event_grant",
    sourceType: CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
    sourceId: userId,
    reason: policy.reason,
    metadata: { grantType: "signup", freeCredits: true },
  });

  return transaction.granted;
}

export async function grantCommunityActivityMilestoneReward(
  userId: string,
  source: { type: "post" | "comment"; id: string },
) {
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

    if (previousReward.rows[0]) {
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
  return { granted: Boolean(row), balanceAfter: row?.balance_after };
}
