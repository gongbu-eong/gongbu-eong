BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

ALTER TABLE public.user_oauth_accounts
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS token_encryption_key_version VARCHAR(30);

CREATE TABLE IF NOT EXISTS public.user_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason_code VARCHAR(40) NOT NULL,
  reason_detail TEXT,
  notice_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  notice_agreed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  oauth_unlink_results JSONB NOT NULL DEFAULT '[]'::JSONB,
  private_data_purge_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  private_data_purged_at TIMESTAMPTZ,
  private_data_purge_error TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_withdrawal_requests_reason_code_check
    CHECK (reason_code IN ('content_lack', 'low_usage', 'privacy_concern', 'inconvenient', 'other')),
  CONSTRAINT user_withdrawal_requests_reason_detail_length_check
    CHECK (reason_detail IS NULL OR char_length(reason_detail) <= 1000),
  CONSTRAINT user_withdrawal_requests_notice_agreed_check
    CHECK (notice_agreed = TRUE)
);

CREATE TABLE IF NOT EXISTS public.withdrawn_oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.oauth_provider NOT NULL,
  provider_user_id_hash TEXT NOT NULL,
  provider_email_hash TEXT,
  withdrawn_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_withdrawal_request_id UUID REFERENCES public.user_withdrawal_requests(id) ON DELETE SET NULL,
  withdrawal_count INTEGER NOT NULL DEFAULT 1,
  retain_until TIMESTAMPTZ NOT NULL,
  welcome_credit_blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT withdrawn_oauth_identities_withdrawal_count_check
    CHECK (withdrawal_count >= 1),
  UNIQUE (provider, provider_user_id_hash)
);

CREATE TABLE IF NOT EXISTS public.user_withdrawal_retained_profiles (
  withdrawal_request_id UUID PRIMARY KEY REFERENCES public.user_withdrawal_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email CITEXT,
  nickname VARCHAR(50),
  display_name VARCHAR(100),
  community_nickname VARCHAR(12),
  phone VARCHAR(30),
  avatar_url TEXT,
  profile_status_message VARCHAR(30),
  profile_avatar_key VARCHAR(30),
  profile_background_color VARCHAR(20),
  gender VARCHAR(20),
  age_group VARCHAR(20),
  selected_diagnosis_result_id UUID,
  selected_resume_id UUID,
  oauth_account_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
  purge_after TIMESTAMPTZ NOT NULL,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_withdrawal_requests
  ADD COLUMN IF NOT EXISTS private_data_purge_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS private_data_purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS private_data_purge_error TEXT;

UPDATE public.user_withdrawal_requests
SET private_data_purge_after = COALESCE(private_data_purge_after, created_at + INTERVAL '30 days');

ALTER TABLE public.user_withdrawal_requests
  ALTER COLUMN private_data_purge_after SET DEFAULT (NOW() + INTERVAL '30 days'),
  ALTER COLUMN private_data_purge_after SET NOT NULL;

ALTER TABLE public.withdrawn_oauth_identities
  ADD COLUMN IF NOT EXISTS first_withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_withdrawal_request_id UUID REFERENCES public.user_withdrawal_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_count INTEGER;

UPDATE public.withdrawn_oauth_identities
SET
  first_withdrawn_at = COALESCE(first_withdrawn_at, withdrawn_at, created_at, NOW()),
  withdrawal_count = COALESCE(withdrawal_count, 1);

ALTER TABLE public.withdrawn_oauth_identities
  ALTER COLUMN first_withdrawn_at SET DEFAULT NOW(),
  ALTER COLUMN first_withdrawn_at SET NOT NULL,
  ALTER COLUMN withdrawal_count SET DEFAULT 1,
  ALTER COLUMN withdrawal_count SET NOT NULL;

CREATE INDEX IF NOT EXISTS user_withdrawal_requests_user_created_idx
  ON public.user_withdrawal_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_withdrawal_requests_purge_due_idx
  ON public.user_withdrawal_requests(private_data_purge_after)
  WHERE private_data_purged_at IS NULL;

CREATE INDEX IF NOT EXISTS withdrawn_oauth_identities_retain_until_idx
  ON public.withdrawn_oauth_identities(retain_until);

CREATE INDEX IF NOT EXISTS withdrawn_oauth_identities_welcome_block_idx
  ON public.withdrawn_oauth_identities(provider, provider_user_id_hash, welcome_credit_blocked_until);

CREATE INDEX IF NOT EXISTS user_withdrawal_retained_profiles_purge_due_idx
  ON public.user_withdrawal_retained_profiles(purge_after)
  WHERE purged_at IS NULL;

COMMIT;
