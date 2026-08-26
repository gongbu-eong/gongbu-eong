-- Create internal tracking tables used for product analytics and user journey logs.
--
-- These tables are intentionally separate from Google Analytics. They store
-- first-party page views, attribution snapshots, product events, and login
-- conversions for later reporting from our own database.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

DO $$
BEGIN
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'main_home';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'diagnosis';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'calendar';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'community';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'ai_tools';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'my_page';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'jobs';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'strength_diagnosis';
  ALTER TYPE public.entry_source ADD VALUE IF NOT EXISTS 'unknown';
EXCEPTION
  WHEN undefined_object THEN
    RAISE EXCEPTION 'public.entry_source type is required before running this migration.';
END $$;

CREATE TABLE IF NOT EXISTS public.auth_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  provider public.oauth_provider,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  anonymous_id UUID,
  event_name VARCHAR(80) NOT NULL DEFAULT 'page_view',
  path TEXT NOT NULL,
  title VARCHAR(255),
  referrer TEXT,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  first_source VARCHAR(100),
  first_medium VARCHAR(100),
  first_campaign VARCHAR(200),
  first_content VARCHAR(200),
  first_term VARCHAR(200),
  first_gclid VARCHAR(255),
  first_fbclid VARCHAR(255),
  first_landing_url TEXT,
  first_landing_path TEXT,
  first_referrer TEXT,
  first_seen_at TIMESTAMPTZ,
  first_raw_payload JSONB,
  last_source VARCHAR(100),
  last_medium VARCHAR(100),
  last_campaign VARCHAR(200),
  last_content VARCHAR(200),
  last_term VARCHAR(200),
  last_gclid VARCHAR(255),
  last_fbclid VARCHAR(255),
  last_landing_url TEXT,
  last_landing_path TEXT,
  last_referrer TEXT,
  last_seen_at TIMESTAMPTZ,
  last_raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  anonymous_id UUID,
  event_name VARCHAR(80) NOT NULL DEFAULT 'attribution_capture',
  source VARCHAR(100),
  medium VARCHAR(100),
  campaign VARCHAR(200),
  content VARCHAR(200),
  term VARCHAR(200),
  gclid VARCHAR(255),
  fbclid VARCHAR(255),
  landing_url TEXT,
  landing_path TEXT,
  referrer TEXT,
  ip_address INET,
  user_agent TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.diagnosis_login_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_run_id UUID NOT NULL REFERENCES public.diagnosis_runs(id),
  diagnosis_result_id UUID REFERENCES public.diagnosis_results(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  provider public.oauth_provider NOT NULL,
  anonymous_id UUID,
  entry_source public.entry_source NOT NULL DEFAULT 'diagnosis',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (diagnosis_run_id, user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  anonymous_id UUID,
  event_type VARCHAR(100) NOT NULL,
  event_source VARCHAR(40) NOT NULL DEFAULT 'server',
  first_source VARCHAR(100),
  first_medium VARCHAR(100),
  first_campaign VARCHAR(200),
  first_content VARCHAR(200),
  first_term VARCHAR(200),
  first_gclid VARCHAR(255),
  first_fbclid VARCHAR(255),
  first_landing_url TEXT,
  first_landing_path TEXT,
  first_referrer TEXT,
  first_seen_at TIMESTAMPTZ,
  first_raw_payload JSONB,
  current_source VARCHAR(100),
  current_medium VARCHAR(100),
  current_campaign VARCHAR(200),
  current_content VARCHAR(200),
  current_term VARCHAR(200),
  current_gclid VARCHAR(255),
  current_fbclid VARCHAR(255),
  current_landing_url TEXT,
  current_landing_path TEXT,
  current_referrer TEXT,
  current_seen_at TIMESTAMPTZ,
  current_raw_payload JSONB,
  diagnosis_run_id UUID REFERENCES public.diagnosis_runs(id) ON DELETE SET NULL,
  diagnosis_result_id UUID REFERENCES public.diagnosis_results(id) ON DELETE SET NULL,
  attempt_no INTEGER,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_events_attempt_no_check
    CHECK (attempt_no IS NULL OR attempt_no >= 1)
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_created
  ON public.auth_login_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created
  ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_path_created
  ON public.access_logs(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_anonymous_created
  ON public.access_logs(anonymous_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created
  ON public.access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_attributions_first_source
  ON public.user_attributions(first_source, first_medium, first_campaign);
CREATE INDEX IF NOT EXISTS idx_user_attributions_last_source
  ON public.user_attributions(last_source, last_medium, last_campaign);
CREATE INDEX IF NOT EXISTS idx_attribution_events_captured
  ON public.attribution_events(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_events_user_captured
  ON public.attribution_events(user_id, captured_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attribution_events_anonymous_captured
  ON public.attribution_events(anonymous_id, captured_at DESC)
  WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attribution_events_source_campaign
  ON public.attribution_events(source, medium, campaign, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_run
  ON public.diagnosis_login_conversions(diagnosis_run_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_user_created
  ON public.diagnosis_login_conversions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_result_user
  ON public.diagnosis_login_conversions(diagnosis_result_id, user_id);
CREATE INDEX IF NOT EXISTS idx_product_events_type_created
  ON public.product_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_user_type_created
  ON public.product_events(user_id, event_type, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_events_anonymous_type_created
  ON public.product_events(anonymous_id, event_type, created_at DESC)
  WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_events_first_source
  ON public.product_events(first_source, first_medium, first_campaign, event_type);
CREATE INDEX IF NOT EXISTS idx_product_events_current_source
  ON public.product_events(current_source, current_medium, current_campaign, event_type);
CREATE UNIQUE INDEX IF NOT EXISTS product_events_diagnosis_run_unique_idx
  ON public.product_events(event_type, diagnosis_run_id)
  WHERE diagnosis_run_id IS NOT NULL;
