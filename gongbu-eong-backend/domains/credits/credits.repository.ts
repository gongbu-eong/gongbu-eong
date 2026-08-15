import type { PoolClient } from "pg";
import { db } from "@/lib/db";

type DbClient = Pick<PoolClient, "query">;

export const CREDIT_REWARD_POLICY = {
  welcomeSignup: {
    amount: 5,
    sourceType: "welcome_signup",
    reason: "신규 가입 무료 진단권 5개",
  },
  communityPostCreate: {
    amount: 1,
    dailyLimit: 3,
    sourceType: "community_post_create",
    reason: "커뮤니티 게시글 작성 보상",
  },
  communityCommentMilestone: {
    amount: 1,
    commentsPerReward: 5,
    dailyLimit: 2,
    sourceType: "community_comment_milestone",
    reason: "커뮤니티 댓글 활동 보상",
  },
} as const;

type CreditRewardPolicy = {
  amount: number;
  dailyLimit?: number;
  milestoneCount?: number;
  isActive: boolean;
  reason: string;
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

  return insertCreditTransaction(client, {
    userId,
    amount: policy.amount,
    sourceType: CREDIT_REWARD_POLICY.welcomeSignup.sourceType,
    sourceId: userId,
    reason: policy.reason,
    metadata: { grantType: "signup", freeCredits: true },
  });
}

export async function grantCommunityPostCreateReward(
  userId: string,
  postId: string,
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const policy = await getCreditRewardPolicy(
      client,
      CREDIT_REWARD_POLICY.communityPostCreate.sourceType,
      {
        amount: CREDIT_REWARD_POLICY.communityPostCreate.amount,
        dailyLimit: CREDIT_REWARD_POLICY.communityPostCreate.dailyLimit,
        isActive: true,
        reason: CREDIT_REWARD_POLICY.communityPostCreate.reason,
      },
    );

    if (!policy.isActive) {
      await client.query("COMMIT");
      return false;
    }

    const dailyCount = await countTodayRewards(
      client,
      userId,
      CREDIT_REWARD_POLICY.communityPostCreate.sourceType,
    );
    const dailyLimit =
      policy.dailyLimit ?? CREDIT_REWARD_POLICY.communityPostCreate.dailyLimit;

    if (dailyCount >= dailyLimit) {
      await client.query("COMMIT");
      return false;
    }

    const granted = await insertCreditTransaction(client, {
      userId,
      amount: policy.amount,
      sourceType: CREDIT_REWARD_POLICY.communityPostCreate.sourceType,
      sourceId: postId,
      reason: policy.reason,
      metadata: {
        postId,
        dailyLimit,
      },
    });
    await client.query("COMMIT");
    return granted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function grantCommunityCommentMilestoneReward(
  userId: string,
  commentId: string,
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const policy = await getCreditRewardPolicy(
      client,
      CREDIT_REWARD_POLICY.communityCommentMilestone.sourceType,
      {
        amount: CREDIT_REWARD_POLICY.communityCommentMilestone.amount,
        dailyLimit: CREDIT_REWARD_POLICY.communityCommentMilestone.dailyLimit,
        milestoneCount:
          CREDIT_REWARD_POLICY.communityCommentMilestone.commentsPerReward,
        isActive: true,
        reason: CREDIT_REWARD_POLICY.communityCommentMilestone.reason,
      },
    );

    if (!policy.isActive) {
      await client.query("COMMIT");
      return false;
    }

    const todayCommentCountResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM public.community_comments
        WHERE user_id = $1
          AND status = 'active'
          AND (created_at AT TIME ZONE 'Asia/Seoul')::date
                = (NOW() AT TIME ZONE 'Asia/Seoul')::date
      `,
      [userId],
    );
    const todayCommentCount = Number(
      todayCommentCountResult.rows[0]?.count || 0,
    );
    const commentsPerReward =
      policy.milestoneCount ??
      CREDIT_REWARD_POLICY.communityCommentMilestone.commentsPerReward;
    const dailyLimit =
      policy.dailyLimit ?? CREDIT_REWARD_POLICY.communityCommentMilestone.dailyLimit;
    const milestone = todayCommentCount / commentsPerReward;

    if (
      !Number.isInteger(milestone) ||
      milestone < 1 ||
      milestone > dailyLimit
    ) {
      await client.query("COMMIT");
      return false;
    }

    const today = await currentKstDate(client);
    const granted = await insertCreditTransaction(client, {
      userId,
      amount: policy.amount,
      sourceType: CREDIT_REWARD_POLICY.communityCommentMilestone.sourceType,
      sourceId: `${today}:${milestone}`,
      reason: `${policy.reason} (${today} ${todayCommentCount}번째 댓글)`,
      metadata: {
        commentId,
        milestone,
        todayCommentCount,
        commentsPerReward,
        dailyLimit,
      },
    });

    await client.query("COMMIT");
    return granted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCreditRewardPolicy(
  client: DbClient,
  rewardKey: string,
  fallback: CreditRewardPolicy,
) {
  try {
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
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") {
      return fallback;
    }

    throw error;
  }
}

async function insertCreditTransaction(
  client: DbClient,
  args: {
    userId: string;
    amount: number;
    sourceType: string;
    sourceId: string;
    reason: string;
    metadata: Record<string, unknown>;
  },
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `credit:${args.userId}`,
  ]);

  const result = await client.query<{ id: string }>(
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
        'event_grant'::public.credit_transaction_type,
        $2,
        current_balance.balance + $2,
        $3,
        $4,
        $5,
        $6::jsonb
      FROM current_balance
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.credit_transactions
        WHERE user_id = $1
          AND source_type = $4
          AND source_id = $5
      )
      RETURNING id
    `,
    [
      args.userId,
      args.amount,
      args.reason,
      args.sourceType,
      args.sourceId,
      JSON.stringify(args.metadata),
    ],
  );

  return Boolean(result.rows[0]);
}

async function countTodayRewards(
  client: DbClient,
  userId: string,
  sourceType: string,
) {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM public.credit_transactions
      WHERE user_id = $1
        AND source_type = $2
        AND (created_at AT TIME ZONE 'Asia/Seoul')::date
              = (NOW() AT TIME ZONE 'Asia/Seoul')::date
    `,
    [userId, sourceType],
  );

  return Number(result.rows[0]?.count || 0);
}

async function currentKstDate(client: DbClient) {
  const result = await client.query<{ today: string }>(
    `SELECT (NOW() AT TIME ZONE 'Asia/Seoul')::date::text AS today`,
  );
  return result.rows[0]?.today || new Date().toISOString().slice(0, 10);
}
