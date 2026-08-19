-- Diagnosis ticket policy update.
-- - New users receive 5 free tickets once.
-- - AI NCS cover-letter coaching consumes 1 ticket per successful request.
-- - Community activity grants 1 ticket whenever posts + comments reach a 3-count milestone.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS source_type varchar(80),
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_reward_source_unique_idx
  ON public.credit_transactions(user_id, source_type, source_id)
  WHERE source_type IS NOT NULL
    AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_transactions_source_created_idx
  ON public.credit_transactions(source_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.credit_reward_policies (
  reward_key varchar(80) PRIMARY KEY,
  description text NOT NULL,
  credit_amount integer NOT NULL,
  daily_limit integer,
  milestone_count integer,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

UPDATE public.credit_reward_policies
SET is_active = false,
    updated_at = NOW()
WHERE reward_key IN ('community_post_create', 'community_comment_milestone');

INSERT INTO public.credit_reward_policies (
  reward_key,
  description,
  credit_amount,
  daily_limit,
  milestone_count,
  is_active,
  metadata
)
VALUES
  (
    'welcome_signup',
    '신규 가입 무료 진단권 5개',
    5,
    NULL,
    NULL,
    true,
    '{"grant_once_per_user": true}'::jsonb
  ),
  (
    'community_activity_milestone',
    '커뮤니티 글·댓글 활동 보상',
    1,
    NULL,
    3,
    true,
    '{"reward_rule": "active_posts_plus_active_comments_every_3"}'::jsonb
  )
ON CONFLICT (reward_key) DO UPDATE SET
  description = EXCLUDED.description,
  credit_amount = EXCLUDED.credit_amount,
  daily_limit = EXCLUDED.daily_limit,
  milestone_count = EXCLUDED.milestone_count,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
