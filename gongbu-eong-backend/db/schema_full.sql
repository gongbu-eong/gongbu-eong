-- 공부엉이 DB 통합 스키마 최신화 스크립트
-- 이 파일은 지금까지 추가/변경한 테이블, 컬럼, 인덱스, seed 데이터를 한 번에 적용합니다.
-- 기존 공고/배치 데이터를 유지하기 위해 DROP SCHEMA/TRUNCATE를 사용하지 않습니다.

CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE pg_namespace.nspname = 'public'
      AND pg_proc.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(pg_proc.oid) = ''
  ) THEN
    EXECUTE '
      CREATE FUNCTION public.set_updated_at()
      RETURNS TRIGGER AS $fn$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql
    ';
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE public.oauth_provider AS ENUM ('kakao', 'naver');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.user_status AS ENUM ('active', 'blocked', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.entry_source AS ENUM (
    'main_home',
    'diagnosis',
    'job_detail',
    'calendar',
    'ai_tools',
    'community',
    'my_page',
    'external_share',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.job_application_status AS ENUM (
    'not_applied',
    'planned',
    'applied',
    'passed_document',
    'interviewing',
    'accepted',
    'rejected',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.job_source AS ENUM ('alio', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.ai_tool_type AS ENUM (
    'strength_diagnosis',
    'resume_coaching',
    'interview_coaching',
    'rejection_analysis',
    'psychology_test'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.credit_transaction_type AS ENUM (
    'purchase',
    'use',
    'refund',
    'admin_adjust',
    'event_grant'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'cancelled',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.post_status AS ENUM ('draft', 'published', 'hidden', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('in_app', 'kakao', 'email', 'sms', 'push');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE,
  nickname VARCHAR(50),
  display_name VARCHAR(100),
  community_nickname VARCHAR(12),
  phone VARCHAR(30),
  avatar_url TEXT,
  profile_status_message VARCHAR(30),
  profile_avatar_key VARCHAR(30) NOT NULL DEFAULT (
    (ARRAY['fox','lion','cat','penguin','chick','monkey','cow','bear','chicken','mouse'])[FLOOR(RANDOM() * 10 + 1)::integer]
  ) CHECK (profile_avatar_key IN ('fox','lion','cat','penguin','chick','monkey','cow','bear','chicken','mouse')),
  profile_background_color VARCHAR(20) NOT NULL DEFAULT '#c4c6ca' CHECK (profile_background_color IN ('#c6d5ff','#b9c9ff','#d1c2ff','#f5bfd9','#c7ecdc','#f5d2b0','#c9d6d8','#c4c6ca')),
  gender VARCHAR(20) CHECK (gender IS NULL OR gender IN ('female','male')),
  age_group VARCHAR(20) CHECK (age_group IS NULL OR age_group IN ('teens','early_20s','late_20s','early_30s','late_30s','over_40')),
  selected_diagnosis_result_id UUID,
  selected_resume_id UUID,
  status public.user_status NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  provider public.oauth_provider NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_email CITEXT,
  provider_nickname VARCHAR(100),
  access_token_hash TEXT,
  refresh_token_hash TEXT,
  token_expires_at TIMESTAMPTZ,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id),
  UNIQUE (user_id, provider)
);

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

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id),
  character_key VARCHAR(50),
  profile_color VARCHAR(20),
  bio VARCHAR(160),
  status_message VARCHAR(160),
  gender VARCHAR(20),
  birth_year SMALLINT,
  preferred_regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  preferred_job_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  preferred_employment_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  terms_key VARCHAR(80) NOT NULL,
  terms_version VARCHAR(30) NOT NULL,
  agreed BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, terms_key, terms_version)
);

CREATE TABLE IF NOT EXISTS public.user_entry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  anonymous_id UUID,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  landing_path TEXT,
  campaign_source VARCHAR(100),
  campaign_medium VARCHAR(100),
  campaign_name VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
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

CREATE TABLE IF NOT EXISTS public.public_institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alio_institution_id VARCHAR(80) UNIQUE,
  name VARCHAR(255) NOT NULL,
  institution_type VARCHAR(100),
  region VARCHAR(100),
  homepage_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source public.job_source NOT NULL DEFAULT 'alio',
  source_posting_id VARCHAR(120),
  institution_id UUID REFERENCES public.public_institutions(id),
  title TEXT NOT NULL,
  ncs_category VARCHAR(150),
  job_category VARCHAR(150),
  work_region VARCHAR(100),
  employment_type VARCHAR(100),
  hiring_count INTEGER,
  education_requirement VARCHAR(100),
  career_requirement VARCHAR(100),
  application_start_at TIMESTAMPTZ,
  application_end_at TIMESTAMPTZ,
  announcement_at TIMESTAMPTZ,
  apply_url TEXT,
  email_apply_address TEXT,
  raw_payload JSONB,
  content_hash VARCHAR(64),
  source_updated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_posting_id)
);

CREATE TABLE IF NOT EXISTS public.job_posting_details (
  job_posting_id UUID PRIMARY KEY REFERENCES public.job_postings(id),
  basic_info TEXT,
  qualification TEXT,
  disqualification TEXT,
  preference TEXT,
  screening_process TEXT,
  application_method TEXT,
  required_documents TEXT,
  additional_notice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_posting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_posting_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_posting_id, stage_order)
);

CREATE TABLE IF NOT EXISTS public.job_posting_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source public.job_source NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetched_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  deactivated_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT job_posting_sync_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  CONSTRAINT job_posting_sync_runs_counts_check
    CHECK (
      fetched_count >= 0
      AND inserted_count >= 0
      AND updated_count >= 0
      AND deactivated_count >= 0
    )
);

CREATE TABLE IF NOT EXISTS public.job_posting_view_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  anonymous_id UUID,
  entry_source VARCHAR(50) NOT NULL DEFAULT 'unknown',
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_posting_daily_stats (
  stat_date DATE NOT NULL,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  view_count BIGINT NOT NULL DEFAULT 0,
  unique_view_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stat_date, job_posting_id),
  CONSTRAINT job_posting_daily_stats_counts_check
    CHECK (view_count >= 0 AND unique_view_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.user_job_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_posting_id)
);

CREATE TABLE IF NOT EXISTS public.user_job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  status public.job_application_status NOT NULL DEFAULT 'not_applied',
  applied_at TIMESTAMPTZ,
  application_channel VARCHAR(50),
  memo TEXT,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_posting_id)
);

CREATE TABLE IF NOT EXISTS public.user_calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID REFERENCES public.job_postings(id),
  title VARCHAR(255) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 1440,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.personality_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  summary TEXT,
  is_stability_oriented BOOLEAN NOT NULL DEFAULT FALSE,
  is_challenge_oriented BOOLEAN NOT NULL DEFAULT FALSE,
  is_analytical BOOLEAN NOT NULL DEFAULT FALSE,
  is_collaborative BOOLEAN NOT NULL DEFAULT FALSE,
  is_leadership BOOLEAN NOT NULL DEFAULT FALSE,
  is_public_service_oriented BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.diagnosis_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.diagnosis_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES public.diagnosis_question_sets(id),
  question_no INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  trait_key VARCHAR(80) NOT NULL,
  reverse_scored BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_set_id, question_no)
);

CREATE TABLE IF NOT EXISTS public.diagnosis_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.diagnosis_questions(id),
  option_no INTEGER NOT NULL,
  option_text VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, option_no)
);

CREATE TABLE IF NOT EXISTS public.diagnosis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  anonymous_id UUID,
  question_set_id UUID NOT NULL REFERENCES public.diagnosis_question_sets(id),
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.diagnosis_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_run_id UUID NOT NULL REFERENCES public.diagnosis_runs(id),
  question_id UUID NOT NULL REFERENCES public.diagnosis_questions(id),
  option_id UUID REFERENCES public.diagnosis_question_options(id),
  answer_value INTEGER,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (diagnosis_run_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.diagnosis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_run_id UUID NOT NULL UNIQUE REFERENCES public.diagnosis_runs(id),
  user_id UUID REFERENCES public.users(id),
  personality_type_id UUID REFERENCES public.personality_types(id),
  total_score INTEGER NOT NULL DEFAULT 0,
  stability_score INTEGER NOT NULL DEFAULT 0,
  challenge_score INTEGER NOT NULL DEFAULT 0,
  analytical_score INTEGER NOT NULL DEFAULT 0,
  stability_axis_percent INTEGER NOT NULL DEFAULT 50,
  teamwork_axis_percent INTEGER NOT NULL DEFAULT 50,
  execution_axis_percent INTEGER NOT NULL DEFAULT 50,
  principle_axis_percent INTEGER NOT NULL DEFAULT 50,
  collaboration_score INTEGER NOT NULL DEFAULT 0,
  leadership_score INTEGER NOT NULL DEFAULT 0,
  public_service_score INTEGER NOT NULL DEFAULT 0,
  is_stability_oriented BOOLEAN NOT NULL DEFAULT FALSE,
  is_challenge_oriented BOOLEAN NOT NULL DEFAULT FALSE,
  is_analytical BOOLEAN NOT NULL DEFAULT FALSE,
  is_collaborative BOOLEAN NOT NULL DEFAULT FALSE,
  is_leadership BOOLEAN NOT NULL DEFAULT FALSE,
  is_public_service_oriented BOOLEAN NOT NULL DEFAULT FALSE,
  summary TEXT,
  strengths JSONB NOT NULL DEFAULT '[]'::JSONB,
  weaknesses JSONB NOT NULL DEFAULT '[]'::JSONB,
  raw_result JSONB,
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

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_selected_diagnosis_result_id_fkey
    FOREIGN KEY (selected_diagnosis_result_id)
    REFERENCES public.diagnosis_results(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_selected_diagnosis_result_id
  ON public.users(selected_diagnosis_result_id);

CREATE TABLE IF NOT EXISTS public.diagnosis_recommended_job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_result_id UUID NOT NULL REFERENCES public.diagnosis_results(id),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  match_score NUMERIC(5,2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (diagnosis_result_id, job_posting_id)
);

CREATE TABLE IF NOT EXISTS public.user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT 'resume',
  original_filename TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'nhn_object_storage',
  storage_container TEXT NOT NULL DEFAULT 'gongbueong',
  storage_object_key TEXT NOT NULL,
  public_url TEXT,
  content_type TEXT,
  size_bytes BIGINT,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) DEFAULT '이력서',
  file_url TEXT,
  extracted_text TEXT,
  user_file_id UUID REFERENCES public.user_files(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('upload', 'manual')),
  title TEXT NOT NULL DEFAULT '이력서',
  name TEXT,
  birth_year TEXT,
  birth_date TEXT,
  email TEXT,
  desired_job TEXT,
  highest_education TEXT,
  gpa TEXT,
  gpa_score TEXT,
  gpa_max TEXT,
  school_major TEXT,
  graduation_status TEXT,
  education_start_date TEXT,
  education_end_date TEXT,
  education_summary TEXT,
  career_summary TEXT,
  certification_summary TEXT,
  additional_notes TEXT,
  completion_percent SMALLINT NOT NULL DEFAULT 0,
  extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resume_parse_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_file_id UUID NOT NULL REFERENCES public.user_files(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_payload JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_resume_parse_jobs_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.user_resume_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  major TEXT,
  degree TEXT,
  start_date TEXT,
  end_date TEXT,
  graduation_status TEXT,
  gpa_score TEXT,
  gpa_max TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.user_resume_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role TEXT,
  position TEXT,
  description TEXT,
  duties TEXT,
  start_date TEXT,
  end_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.user_resume_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  certificate_name TEXT NOT NULL,
  issuer TEXT,
  acquired_year TEXT,
  acquired_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.user_resume_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  contest_name TEXT NOT NULL,
  award_name TEXT,
  issuer TEXT,
  awarded_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_resume_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  description TEXT,
  issuer TEXT,
  activity_date TEXT,
  start_date TEXT,
  end_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_resume_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  language_name TEXT,
  test_name TEXT,
  level_or_score TEXT,
  issuer TEXT,
  acquired_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS community_nickname VARCHAR(12),
  ADD COLUMN IF NOT EXISTS profile_status_message VARCHAR(30),
  ADD COLUMN IF NOT EXISTS profile_avatar_key VARCHAR(30) NOT NULL DEFAULT (
    (ARRAY['fox','lion','cat','penguin','chick','monkey','cow','bear','chicken','mouse'])[FLOOR(RANDOM() * 10 + 1)::INTEGER]
  ),
  ADD COLUMN IF NOT EXISTS profile_background_color VARCHAR(20) NOT NULL DEFAULT '#c4c6ca',
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS age_group VARCHAR(20),
  ADD COLUMN IF NOT EXISTS selected_resume_id UUID;

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.user_resumes
  ADD COLUMN IF NOT EXISTS user_file_id UUID,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS birth_year TEXT,
  ADD COLUMN IF NOT EXISTS birth_date TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS desired_job TEXT,
  ADD COLUMN IF NOT EXISTS highest_education TEXT,
  ADD COLUMN IF NOT EXISTS gpa TEXT,
  ADD COLUMN IF NOT EXISTS gpa_score TEXT,
  ADD COLUMN IF NOT EXISTS gpa_max TEXT,
  ADD COLUMN IF NOT EXISTS school_major TEXT,
  ADD COLUMN IF NOT EXISTS graduation_status TEXT,
  ADD COLUMN IF NOT EXISTS education_start_date TEXT,
  ADD COLUMN IF NOT EXISTS education_end_date TEXT,
  ADD COLUMN IF NOT EXISTS education_summary TEXT,
  ADD COLUMN IF NOT EXISTS career_summary TEXT,
  ADD COLUMN IF NOT EXISTS certification_summary TEXT,
  ADD COLUMN IF NOT EXISTS additional_notes TEXT,
  ADD COLUMN IF NOT EXISTS completion_percent SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extracted_payload JSONB NOT NULL DEFAULT '{}'::JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_resumes'
      AND column_name = 'file_name'
  ) THEN
    EXECUTE 'UPDATE public.user_resumes SET title = COALESCE(NULLIF(title, ''''), NULLIF(file_name, ''''), ''이력서'') WHERE title IS NULL';
    ALTER TABLE public.user_resumes ALTER COLUMN file_name DROP NOT NULL;
  ELSE
    UPDATE public.user_resumes
    SET title = '이력서'
    WHERE title IS NULL;
  END IF;
END $$;

ALTER TABLE public.user_resumes
  ALTER COLUMN title SET DEFAULT '이력서',
  ALTER COLUMN title SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_resumes_source_type'
  ) THEN
    ALTER TABLE public.user_resumes
      ADD CONSTRAINT chk_user_resumes_source_type
      CHECK (source_type IN ('upload', 'manual'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_resumes_user_file'
  ) THEN
    ALTER TABLE public.user_resumes
      ADD CONSTRAINT fk_user_resumes_user_file
      FOREIGN KEY (user_file_id)
      REFERENCES public.user_files(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_selected_resume'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT fk_users_selected_resume
      FOREIGN KEY (selected_resume_id)
      REFERENCES public.user_resumes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.user_resume_educations
  ADD COLUMN IF NOT EXISTS graduation_status TEXT,
  ADD COLUMN IF NOT EXISTS gpa_score TEXT,
  ADD COLUMN IF NOT EXISTS gpa_max TEXT;

ALTER TABLE public.user_resume_experiences
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS duties TEXT;

ALTER TABLE public.user_resume_certifications
  ADD COLUMN IF NOT EXISTS acquired_date TEXT;

ALTER TABLE public.user_resume_awards
  ADD COLUMN IF NOT EXISTS issuer TEXT;

ALTER TABLE public.user_resume_activities
  ADD COLUMN IF NOT EXISTS issuer TEXT;

ALTER TABLE public.user_resume_languages
  ADD COLUMN IF NOT EXISTS issuer TEXT,
  ALTER COLUMN language_name DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  anonymous_id UUID,
  ai_tool_type public.ai_tool_type NOT NULL,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  credit_used INTEGER NOT NULL DEFAULT 0,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resume_coaching_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID REFERENCES public.job_postings(id),
  resume_id UUID REFERENCES public.user_resumes(id) ON DELETE SET NULL,
  input_type VARCHAR(20) NOT NULL DEFAULT 'text',
  source_file_id UUID REFERENCES public.user_files(id),
  source_filename TEXT,
  prompt_text TEXT,
  input_text TEXT NOT NULL,
  job_posting_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.resume_coaching_requests
  ADD COLUMN IF NOT EXISTS input_type VARCHAR(20) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.user_files(id),
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS job_posting_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE TABLE IF NOT EXISTS public.resume_coaching_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.resume_coaching_requests(id),
  score INTEGER,
  corrected_text TEXT,
  feedback JSONB NOT NULL DEFAULT '{}'::JSONB,
  model_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.interview_coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID REFERENCES public.job_postings(id),
  resume_id UUID REFERENCES public.user_resumes(id) ON DELETE SET NULL,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.interview_coaching_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.interview_coaching_sessions(id),
  message_order INTEGER NOT NULL,
  role VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  feedback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, message_order)
);

CREATE TABLE IF NOT EXISTS public.rejection_analysis_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID REFERENCES public.job_postings(id),
  application_id UUID REFERENCES public.user_job_applications(id),
  input_text TEXT,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rejection_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.rejection_analysis_requests(id),
  reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
  improvement_plan JSONB NOT NULL DEFAULT '{}'::JSONB,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::JSONB,
  model_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  credit_amount INTEGER NOT NULL,
  bonus_credit_amount INTEGER NOT NULL DEFAULT 0,
  price_krw INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  credit_package_id UUID REFERENCES public.credit_packages(id),
  payment_provider VARCHAR(50),
  provider_payment_id VARCHAR(255),
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount_krw INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  payment_id UUID REFERENCES public.payments(id),
  ai_usage_event_id UUID REFERENCES public.ai_usage_events(id),
  transaction_type public.credit_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  source_type VARCHAR(80),
  source_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_reward_policies (
  reward_key VARCHAR(80) PRIMARY KEY,
  description TEXT NOT NULL,
  credit_amount INTEGER NOT NULL,
  daily_limit INTEGER,
  milestone_count INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  content TEXT NOT NULL,
  image_data_url TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, reaction_type),
  CONSTRAINT community_post_reactions_type_check
    CHECK (reaction_type IN ('recommend', 'scrap'))
);

CREATE TABLE IF NOT EXISTS public.community_post_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  file_data_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_comment_reactions_type_check
    CHECK (reaction_type IN ('like', 'dislike')),
  CONSTRAINT community_comment_reactions_comment_user_unique
    UNIQUE (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(20) NOT NULL,
  target_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason VARCHAR(120),
  reason_code VARCHAR(60),
  reason_detail TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  target_snapshot JSONB,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_reports_target_type_check
    CHECK (target_type IN ('post', 'comment')),
  CONSTRAINT community_reports_status_check
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.community_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  query VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_search_terms (
  query VARCHAR(80) PRIMARY KEY,
  search_count INTEGER NOT NULL DEFAULT 0,
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT '자유·잡담',
  ADD COLUMN IF NOT EXISTS image_data_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.community_posts
  ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT,
  ALTER COLUMN status SET DEFAULT 'active';

UPDATE public.community_posts
SET status = 'active'
WHERE status = 'published';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_posts'
      AND column_name = 'board_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.community_posts ALTER COLUMN board_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.community_comments
  ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT,
  ALTER COLUMN status SET DEFAULT 'active';

UPDATE public.community_comments
SET status = 'active'
WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id),
  application_deadline_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  application_deadline_days_before INTEGER NOT NULL DEFAULT 3,
  application_deadline_days_before_list INTEGER[] NOT NULL DEFAULT ARRAY[3]::INTEGER[],
  tailored_job_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_agreed_at TIMESTAMPTZ,
  marketing_revoked_at TIMESTAMPTZ,
  kakao_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kakao_connected_at TIMESTAMPTZ,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS application_deadline_days_before_list INTEGER[] NOT NULL DEFAULT ARRAY[3]::INTEGER[],
  ADD COLUMN IF NOT EXISTS marketing_agreed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kakao_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  target_path TEXT,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_dispatch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  target_path TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_dispatch_queue_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  CONSTRAINT notification_dispatch_queue_attempt_count_check
    CHECK (attempt_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.support_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  email CITEXT,
  category VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(80) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.policy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  version VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_key, version)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON public.user_oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_user_created ON public.auth_login_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON public.user_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON public.access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_path_created ON public.access_logs(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_anonymous_created ON public.access_logs(anonymous_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_created ON public.access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_events_user_created ON public.user_entry_events(user_id, created_at DESC);
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

CREATE INDEX IF NOT EXISTS idx_job_postings_end_at ON public.job_postings(application_end_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_institution ON public.job_postings(institution_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_region_category ON public.job_postings(work_region, job_category);
CREATE INDEX IF NOT EXISTS idx_job_posting_sync_runs_source_started
  ON public.job_posting_sync_runs(source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_active_end_created
  ON public.job_postings(application_end_at ASC, created_at DESC)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_postings_active_source_external_id
  ON public.job_postings(source, source_posting_id)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_postings_calendar_start_end
  ON public.job_postings(application_start_at, application_end_at);
CREATE INDEX IF NOT EXISTS idx_job_view_events_posting_viewed
  ON public.job_posting_view_events(job_posting_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_view_events_viewed_brin
  ON public.job_posting_view_events USING BRIN(viewed_at);
CREATE INDEX IF NOT EXISTS idx_job_view_events_user_viewed
  ON public.job_posting_view_events(user_id, viewed_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_daily_stats_posting_date
  ON public.job_posting_daily_stats(job_posting_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_bookmarks_user ON public.user_job_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_status ON public.user_job_applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_user_starts ON public.user_calendar_items(user_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_diagnosis_runs_user_created ON public.diagnosis_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_runs_anonymous ON public.diagnosis_runs(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_user ON public.diagnosis_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_results_type_created ON public.diagnosis_results(personality_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_run ON public.diagnosis_login_conversions(diagnosis_run_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_user_created ON public.diagnosis_login_conversions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_result_user ON public.diagnosis_login_conversions(diagnosis_result_id, user_id);
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
CREATE INDEX IF NOT EXISTS idx_job_postings_announcement_created ON public.job_postings(announcement_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_files_user_created
  ON public.user_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_user_created ON public.user_resumes(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_resumes_selected_one
  ON public.user_resumes(user_id)
  WHERE is_selected = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_created
  ON public.user_resumes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_title
  ON public.user_resumes(user_id, title);
CREATE INDEX IF NOT EXISTS idx_resume_parse_jobs_user_created
  ON public.resume_parse_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_parse_jobs_status_created
  ON public.resume_parse_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_resume_coaching_requests_user_created
  ON public.resume_coaching_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_coaching_requests_source_file
  ON public.resume_coaching_requests(source_file_id);
CREATE INDEX IF NOT EXISTS idx_user_resume_awards_resume_id
  ON public.user_resume_awards(resume_id);
CREATE INDEX IF NOT EXISTS idx_user_resume_activities_resume_id
  ON public.user_resume_activities(resume_id);
CREATE INDEX IF NOT EXISTS idx_user_resume_languages_resume_id
  ON public.user_resume_languages(resume_id);
CREATE UNIQUE INDEX IF NOT EXISTS credit_packages_name_unique_idx
  ON public.credit_packages(name);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_reward_source_unique_idx
  ON public.credit_transactions(user_id, source_type, source_id)
  WHERE source_type IS NOT NULL
    AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_transactions_source_created_idx
  ON public.credit_transactions(source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS community_posts_status_created_idx
  ON public.community_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_category_idx
  ON public.community_posts(category);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS community_comments_active_post_idx
  ON public.community_comments(post_id, created_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS community_comments_parent_idx
  ON public.community_comments(parent_comment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_reactions_user_idx
  ON public.community_post_reactions(user_id, reaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS community_reactions_post_type_idx
  ON public.community_post_reactions(post_id, reaction_type);
CREATE INDEX IF NOT EXISTS community_comment_reactions_user_idx
  ON public.community_comment_reactions(user_id, reaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS community_comment_reactions_comment_type_idx
  ON public.community_comment_reactions(comment_id, reaction_type);
CREATE INDEX IF NOT EXISTS community_attachments_post_idx
  ON public.community_post_attachments(post_id, sort_order, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_unique_target_idx
  ON public.community_reports(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS community_reports_status_idx
  ON public.community_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_search_logs_query_idx
  ON public.community_search_logs(query, created_at DESC);
CREATE INDEX IF NOT EXISTS community_search_logs_query_created_idx
  ON public.community_search_logs(query, created_at DESC);
CREATE INDEX IF NOT EXISTS community_search_logs_created_query_idx
  ON public.community_search_logs(created_at DESC, query);
CREATE INDEX IF NOT EXISTS community_search_terms_count_idx
  ON public.community_search_terms(search_count DESC, last_searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_pending
  ON public.notification_dispatch_queue(scheduled_at, created_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_user_created
  ON public.notification_dispatch_queue(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_dispatch_queue_status_created
  ON public.notification_dispatch_queue(status, created_at DESC);

DROP VIEW IF EXISTS public.job_posting_hot_7d;
CREATE VIEW public.job_posting_hot_7d AS
SELECT
  stats.job_posting_id,
  SUM(stats.view_count)::BIGINT AS view_count,
  SUM(stats.unique_view_count)::BIGINT AS unique_view_count
FROM public.job_posting_daily_stats stats
WHERE stats.stat_date >= (NOW() AT TIME ZONE 'Asia/Seoul')::DATE - 6
GROUP BY stats.job_posting_id;

DROP VIEW IF EXISTS public.community_report_target_summary;
CREATE VIEW public.community_report_target_summary AS
SELECT
  reports.target_type,
  reports.target_id,
  COUNT(*)::INTEGER AS report_count,
  COUNT(*) FILTER (WHERE reports.status = 'pending')::INTEGER AS pending_count,
  COUNT(*) FILTER (WHERE reports.status = 'reviewing')::INTEGER AS reviewing_count,
  COUNT(*) FILTER (WHERE reports.status = 'resolved')::INTEGER AS resolved_count,
  COUNT(*) FILTER (WHERE reports.status = 'rejected')::INTEGER AS rejected_count,
  MIN(reports.created_at) AS first_reported_at,
  MAX(reports.created_at) AS last_reported_at,
  JSONB_OBJECT_AGG(reports.reason_code, reason_counts.reason_count)
    FILTER (WHERE reports.reason_code IS NOT NULL) AS reason_counts,
  (ARRAY_AGG(reports.target_snapshot ORDER BY reports.created_at DESC))[1] AS latest_target_snapshot
FROM public.community_reports reports
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INTEGER AS reason_count
  FROM public.community_reports reason_reports
  WHERE reason_reports.target_type = reports.target_type
    AND reason_reports.target_id = reports.target_id
    AND reason_reports.reason_code = reports.reason_code
) reason_counts ON TRUE
GROUP BY reports.target_type, reports.target_id;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'user_oauth_accounts',
    'user_profiles',
    'user_attributions',
    'public_institutions',
    'job_postings',
    'job_posting_details',
    'user_job_applications',
    'user_calendar_items',
    'personality_types',
    'diagnosis_question_sets',
    'diagnosis_questions',
    'user_resumes',
    'credit_packages',
    'payments',
    'community_posts',
    'community_comments',
    'notification_preferences',
    'notification_dispatch_queue',
    'support_inquiries',
    'faqs'
  ]
  LOOP
    EXECUTE FORMAT('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', table_name);
    EXECUTE FORMAT(
      'CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.set_updated_at()',
      table_name
    );
  END LOOP;
END $$;

INSERT INTO public.community_boards (code, name, sort_order)
VALUES
  ('review', '후기', 10),
  ('pass', '합격', 20),
  ('question', '질문', 30),
  ('free', '자유', 40)
ON CONFLICT (code) DO NOTHING;

UPDATE public.credit_packages
SET is_active = FALSE,
    updated_at = NOW()
WHERE name NOT IN ('진단권 10개', '진단권 30개', '진단권 60개');

INSERT INTO public.credit_packages (
  name,
  credit_amount,
  bonus_credit_amount,
  price_krw,
  is_active,
  sort_order
)
VALUES
  ('진단권 10개', 10, 0, 2900, TRUE, 10),
  ('진단권 30개', 30, 5, 9900, TRUE, 20),
  ('진단권 60개', 60, 15, 19900, TRUE, 30)
ON CONFLICT (name) DO UPDATE SET
  credit_amount = EXCLUDED.credit_amount,
  bonus_credit_amount = EXCLUDED.bonus_credit_amount,
  price_krw = EXCLUDED.price_krw,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

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
    TRUE,
    '{"grant_once_per_user": true}'::JSONB
  ),
  (
    'community_activity_milestone',
    '커뮤니티 글·댓글 활동 보상',
    1,
    NULL,
    3,
    TRUE,
    '{"reward_rule": "active_posts_plus_active_comments_every_3"}'::JSONB
  ),
  (
    'diagnosis_result_share',
    '강점·성향 진단 결과 공유 보상',
    1,
    NULL,
    NULL,
    TRUE,
    '{"grant_once_per_result": true}'::JSONB
  )
ON CONFLICT (reward_key) DO UPDATE SET
  description = EXCLUDED.description,
  credit_amount = EXCLUDED.credit_amount,
  daily_limit = EXCLUDED.daily_limit,
  milestone_count = EXCLUDED.milestone_count,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();


-- ============================================================
-- Diagnosis seed: 8 personality types, active 16 questions, options
-- ============================================================

INSERT INTO public.personality_types (
  code,
  name,
  summary,
  is_stability_oriented,
  is_challenge_oriented,
  is_analytical,
  is_collaborative,
  is_public_service_oriented
)
VALUES
  (
    'stability',
    '안정 추구형',
    '예측 가능한 환경에서 꾸준히 성과를 쌓는 타입이에요.',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    TRUE
  ),
  (
    'challenge',
    '도전 개척형',
    '새로운 기회와 변화 속에서 동기가 살아나는 타입이에요.',
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  ),
  (
    'teamwork',
    '협업 조력형',
    '사람들과 의견을 맞추며 함께 성과를 만드는 타입이에요.',
    FALSE,
    FALSE,
    FALSE,
    TRUE,
    TRUE
  ),
  (
    'individual',
    '독립 몰입형',
    '혼자 집중해 판단하고 완성도를 끌어올리는 타입이에요.',
    FALSE,
    FALSE,
    TRUE,
    FALSE,
    FALSE
  ),
  (
    'execution',
    '실행 추진형',
    '고민보다 행동으로 먼저 흐름을 만드는 타입이에요.',
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  ),
  (
    'planning',
    '전략 기획형',
    '분석과 우선순위로 효율적인 길을 찾는 타입이에요.',
    FALSE,
    FALSE,
    TRUE,
    FALSE,
    TRUE
  ),
  (
    'principle',
    '정밀 관리형',
    '기준과 세부 사항을 꼼꼼히 확인하는 타입이에요.',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    TRUE
  ),
  (
    'flexibility',
    '유연 대응형',
    '상황 변화에 맞춰 현실적인 대안을 찾는 타입이에요.',
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  is_stability_oriented = EXCLUDED.is_stability_oriented,
  is_challenge_oriented = EXCLUDED.is_challenge_oriented,
  is_analytical = EXCLUDED.is_analytical,
  is_collaborative = EXCLUDED.is_collaborative,
  is_public_service_oriented = EXCLUDED.is_public_service_oriented,
  updated_at = NOW();

INSERT INTO public.diagnosis_question_sets (code, title, version, is_active)
VALUES ('civil-service-basic-v1', '강점·성향 진단(기본)', 4, TRUE)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  version = EXCLUDED.version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH question_set AS (
  SELECT id FROM public.diagnosis_question_sets WHERE code = 'civil-service-basic-v1'
),
questions AS (
  SELECT *
  FROM (
    VALUES
      (1, '정해진 절차와 기준이 있을 때 더 편하게 집중할 수 있다.', 'stability_axis', FALSE),
      (2, '사람들과 의견을 나누며 방향을 정할 때 더 좋은 결과가 나온다고 느낀다.', 'teamwork_axis', FALSE),
      (3, '계획이 완벽하지 않아도 우선 시작하면서 방향을 잡는 편이다.', 'execution_axis', FALSE),
      (4, '정해진 규칙과 원칙은 가능한 한 정확히 지켜야 한다고 생각한다.', 'principle_axis', FALSE),
      (5, '해야 할 일이 생기면 오래 고민하기보다 먼저 움직이는 편이다.', 'execution_axis', FALSE),
      (6, '작은 실수나 빠진 조건도 그냥 넘기지 않고 다시 확인하는 편이다.', 'principle_axis', FALSE),
      (7, '결과가 어느 정도 예측되는 공부 방식이나 업무 방식이 나에게 잘 맞는다.', 'stability_axis', FALSE),
      (8, '혼자 결정하기보다 주변의 피드백을 듣고 조정하는 과정이 편하다.', 'teamwork_axis', FALSE),
      (9, '일을 마무리하기 전 세부 조건이 맞는지 꼼꼼히 점검한다.', 'principle_axis', FALSE),
      (10, '생각만 오래 하기보다 작은 행동으로 확인하는 방식이 나에게 맞다.', 'execution_axis', FALSE),
      (11, '역할을 나누고 서로 보완하는 방식이 나에게 잘 맞는다.', 'teamwork_axis', FALSE),
      (12, '새로운 방식을 시도하기 전, 먼저 검증된 방법이 있는지 확인하는 편이다.', 'stability_axis', FALSE),
      (13, '중요한 일을 할 때도 함께 논의할 사람이 있으면 더 안정감을 느낀다.', 'teamwork_axis', FALSE),
      (14, '변수가 많은 상황보다 안정적으로 준비할 수 있는 환경이 더 좋다.', 'stability_axis', FALSE),
      (15, '기준이 명확할수록 더 안정적으로 일할 수 있다.', 'principle_axis', FALSE),
      (16, '실행하면서 부족한 부분을 수정해 나가는 편이 더 효율적이라고 느낀다.', 'execution_axis', FALSE)
  ) AS q(question_no, question_text, trait_key, reverse_scored)
)
INSERT INTO public.diagnosis_questions (
  question_set_id,
  question_no,
  question_text,
  trait_key,
  reverse_scored,
  is_active
)
SELECT
  question_set.id,
  questions.question_no,
  questions.question_text,
  questions.trait_key,
  questions.reverse_scored,
  TRUE
FROM question_set
CROSS JOIN questions
ON CONFLICT (question_set_id, question_no) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  trait_key = EXCLUDED.trait_key,
  reverse_scored = EXCLUDED.reverse_scored,
  is_active = TRUE,
  updated_at = NOW();

UPDATE public.diagnosis_questions
SET is_active = FALSE,
    updated_at = NOW()
WHERE question_set_id = (
    SELECT id FROM public.diagnosis_question_sets WHERE code = 'civil-service-basic-v1'
  )
  AND question_no > 16;

WITH options AS (
  SELECT *
  FROM (
    VALUES
      (1, '전혀 아니다.', 1),
      (2, '아닌 편이다.', 2),
      (3, '보통이다.', 3),
      (4, '그런 편이다.', 4),
      (5, '매우 그렇다.', 5)
  ) AS o(option_no, option_text, score)
)
INSERT INTO public.diagnosis_question_options (
  question_id,
  option_no,
  option_text,
  score
)
SELECT
  diagnosis_questions.id,
  options.option_no,
  options.option_text,
  options.score
FROM public.diagnosis_questions
CROSS JOIN options
JOIN public.diagnosis_question_sets
  ON diagnosis_question_sets.id = diagnosis_questions.question_set_id
WHERE diagnosis_question_sets.code = 'civil-service-basic-v1'
  AND diagnosis_questions.is_active = TRUE
ON CONFLICT (question_id, option_no) DO UPDATE SET
  option_text = EXCLUDED.option_text,
  score = EXCLUDED.score;


-- ============================================================
-- Diagnosis axis columns/comments
-- ============================================================

ALTER TABLE public.diagnosis_results
  ADD COLUMN IF NOT EXISTS stability_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS teamwork_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS execution_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS principle_axis_percent INTEGER NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'diagnosis_results'
      AND column_name = 'challenge_axis_percent'
  ) THEN
    EXECUTE '
      UPDATE public.diagnosis_results
      SET
        stability_axis_percent = COALESCE(challenge_axis_percent, stability_axis_percent),
        teamwork_axis_percent = COALESCE(individual_axis_percent, teamwork_axis_percent),
        execution_axis_percent = COALESCE(planning_axis_percent, execution_axis_percent),
        principle_axis_percent = COALESCE(flexibility_axis_percent, principle_axis_percent)
    ';
  END IF;
END $$;

COMMENT ON COLUMN public.diagnosis_results.stability_axis_percent
  IS '안정지향 ↔ 도전 축에서 왼쪽 성향(안정지향)에 가까운 정도(0~100)';
COMMENT ON COLUMN public.diagnosis_results.teamwork_axis_percent
  IS '팀 협업 ↔ 개인 축에서 왼쪽 성향(팀 협업)에 가까운 정도(0~100)';
COMMENT ON COLUMN public.diagnosis_results.execution_axis_percent
  IS '실행력 ↔ 기획 축에서 왼쪽 성향(실행력)에 가까운 정도(0~100)';
COMMENT ON COLUMN public.diagnosis_results.principle_axis_percent
  IS '원칙·꼼꼼함 ↔ 유연 축에서 왼쪽 성향(원칙·꼼꼼함)에 가까운 정도(0~100)';


-- ============================================================
-- Diagnosis final shuffled question order v4
-- ============================================================

-- 강점·성향 진단 문항 노출 순서를 섞는다.
-- 문항 내용, trait_key, 선택지 점수는 유지하고 question_no만 재배치한다.
-- 각 4문항 구간에 안정/협업/실행/원칙 축이 하나씩 포함되도록 구성했다.

UPDATE public.diagnosis_question_sets
SET version = 4,
    updated_at = NOW()
WHERE code = 'civil-service-basic-v1';

WITH question_set AS (
  SELECT id
  FROM public.diagnosis_question_sets
  WHERE code = 'civil-service-basic-v1'
),
questions AS (
  SELECT *
  FROM (
    VALUES
      (1, '정해진 절차와 기준이 있을 때 더 편하게 집중할 수 있다.', 'stability_axis', FALSE),
      (2, '사람들과 의견을 나누며 방향을 정할 때 더 좋은 결과가 나온다고 느낀다.', 'teamwork_axis', FALSE),
      (3, '계획이 완벽하지 않아도 우선 시작하면서 방향을 잡는 편이다.', 'execution_axis', FALSE),
      (4, '정해진 규칙과 원칙은 가능한 한 정확히 지켜야 한다고 생각한다.', 'principle_axis', FALSE),
      (5, '해야 할 일이 생기면 오래 고민하기보다 먼저 움직이는 편이다.', 'execution_axis', FALSE),
      (6, '작은 실수나 빠진 조건도 그냥 넘기지 않고 다시 확인하는 편이다.', 'principle_axis', FALSE),
      (7, '결과가 어느 정도 예측되는 공부 방식이나 업무 방식이 나에게 잘 맞는다.', 'stability_axis', FALSE),
      (8, '혼자 결정하기보다 주변의 피드백을 듣고 조정하는 과정이 편하다.', 'teamwork_axis', FALSE),
      (9, '일을 마무리하기 전 세부 조건이 맞는지 꼼꼼히 점검한다.', 'principle_axis', FALSE),
      (10, '생각만 오래 하기보다 작은 행동으로 확인하는 방식이 나에게 맞다.', 'execution_axis', FALSE),
      (11, '역할을 나누고 서로 보완하는 방식이 나에게 잘 맞는다.', 'teamwork_axis', FALSE),
      (12, '새로운 방식을 시도하기 전, 먼저 검증된 방법이 있는지 확인하는 편이다.', 'stability_axis', FALSE),
      (13, '중요한 일을 할 때도 함께 논의할 사람이 있으면 더 안정감을 느낀다.', 'teamwork_axis', FALSE),
      (14, '변수가 많은 상황보다 안정적으로 준비할 수 있는 환경이 더 좋다.', 'stability_axis', FALSE),
      (15, '기준이 명확할수록 더 안정적으로 일할 수 있다.', 'principle_axis', FALSE),
      (16, '실행하면서 부족한 부분을 수정해 나가는 편이 더 효율적이라고 느낀다.', 'execution_axis', FALSE)
  ) AS q(question_no, question_text, trait_key, reverse_scored)
)
INSERT INTO public.diagnosis_questions (
  question_set_id,
  question_no,
  question_text,
  trait_key,
  reverse_scored,
  is_active
)
SELECT
  question_set.id,
  questions.question_no,
  questions.question_text,
  questions.trait_key,
  questions.reverse_scored,
  TRUE
FROM question_set
CROSS JOIN questions
ON CONFLICT (question_set_id, question_no) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  trait_key = EXCLUDED.trait_key,
  reverse_scored = EXCLUDED.reverse_scored,
  is_active = TRUE,
  updated_at = NOW();

WITH options AS (
  SELECT *
  FROM (
    VALUES
      (1, '전혀 아니다.', 1),
      (2, '아닌 편이다.', 2),
      (3, '보통이다.', 3),
      (4, '그런 편이다.', 4),
      (5, '매우 그렇다.', 5)
  ) AS o(option_no, option_text, score)
)
INSERT INTO public.diagnosis_question_options (
  question_id,
  option_no,
  option_text,
  score
)
SELECT
  diagnosis_questions.id,
  options.option_no,
  options.option_text,
  options.score
FROM public.diagnosis_questions
CROSS JOIN options
JOIN public.diagnosis_question_sets
  ON diagnosis_question_sets.id = diagnosis_questions.question_set_id
WHERE diagnosis_question_sets.code = 'civil-service-basic-v1'
  AND diagnosis_questions.is_active = TRUE
ON CONFLICT (question_id, option_no) DO UPDATE SET
  option_text = EXCLUDED.option_text,
  score = EXCLUDED.score;


-- ============================================================
-- Job categories, posting-category sync, personality mappings
-- ============================================================

CREATE TABLE IF NOT EXISTS public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_posting_categories (
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  job_category_id UUID NOT NULL REFERENCES public.job_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_posting_id, job_category_id)
);

CREATE TABLE IF NOT EXISTS public.personality_job_category_mappings (
  personality_type_id UUID NOT NULL REFERENCES public.personality_types(id) ON DELETE CASCADE,
  job_category_id UUID NOT NULL REFERENCES public.job_categories(id) ON DELETE CASCADE,
  fit_weight SMALLINT NOT NULL CHECK (fit_weight BETWEEN 1 AND 100),
  reason TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (personality_type_id, job_category_id)
);

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO public.job_categories (source_code, name, sort_order)
VALUES
  ('R600001', '사업관리', 1),
  ('R600002', '경영·회계·사무', 2),
  ('R600003', '금융·보험', 3),
  ('R600004', '교육·자연·사회과학', 4),
  ('R600005', '법률·경찰·소방·교도·국방', 5),
  ('R600006', '보건·의료', 6),
  ('R600007', '사회복지·종교', 7),
  ('R600008', '문화·예술·디자인·방송', 8),
  ('R600009', '운전·운송', 9),
  ('R600010', '영업·판매', 10),
  ('R600011', '경비·청소', 11),
  ('R600012', '이용·숙박·여행·오락·스포츠', 12),
  ('R600013', '음식서비스', 13),
  ('R600014', '건설', 14),
  ('R600015', '기계', 15),
  ('R600016', '재료', 16),
  ('R600017', '화학', 17),
  ('R600018', '섬유·의복', 18),
  ('R600019', '전기·전자', 19),
  ('R600020', '정보통신', 20),
  ('R600021', '식품가공', 21),
  ('R600022', '인쇄·목재·가구·공예', 22),
  ('R600023', '환경·에너지·안전', 23),
  ('R600024', '농림어업', 24),
  ('R600025', '연구', 25)
ON CONFLICT (source_code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

WITH mapping(personality_code, category_code, fit_weight, sort_order) AS (
  VALUES
    ('stability', 'R600011', 100, 1),
    ('stability', 'R600006', 90, 2),
    ('stability', 'R600023', 90, 3),
    ('stability', 'R600005', 85, 4),
    ('stability', 'R600009', 85, 5),
    ('stability', 'R600024', 85, 6),
    ('stability', 'R600002', 80, 7),
    ('stability', 'R600003', 80, 8),
    ('stability', 'R600021', 80, 9),
    ('stability', 'R600013', 65, 10),

    ('challenge', 'R600010', 100, 1),
    ('challenge', 'R600008', 90, 2),
    ('challenge', 'R600020', 85, 3),
    ('challenge', 'R600025', 85, 4),
    ('challenge', 'R600012', 80, 5),
    ('challenge', 'R600004', 75, 6),
    ('challenge', 'R600014', 70, 7),
    ('challenge', 'R600015', 70, 8),

    ('teamwork', 'R600006', 100, 1),
    ('teamwork', 'R600007', 100, 2),
    ('teamwork', 'R600012', 100, 3),
    ('teamwork', 'R600004', 95, 4),
    ('teamwork', 'R600010', 90, 5),
    ('teamwork', 'R600013', 90, 6),
    ('teamwork', 'R600001', 85, 7),
    ('teamwork', 'R600008', 75, 8),
    ('teamwork', 'R600005', 70, 9),

    ('individual', 'R600022', 100, 1),
    ('individual', 'R600020', 90, 2),
    ('individual', 'R600025', 90, 3),
    ('individual', 'R600018', 85, 4),
    ('individual', 'R600015', 80, 5),
    ('individual', 'R600016', 80, 6),
    ('individual', 'R600017', 80, 7),
    ('individual', 'R600024', 80, 8),
    ('individual', 'R600008', 80, 9),
    ('individual', 'R600019', 75, 10),
    ('individual', 'R600009', 70, 11),
    ('individual', 'R600002', 70, 12),

    ('execution', 'R600009', 100, 1),
    ('execution', 'R600013', 100, 2),
    ('execution', 'R600014', 100, 3),
    ('execution', 'R600015', 100, 4),
    ('execution', 'R600024', 100, 5),
    ('execution', 'R600021', 90, 6),
    ('execution', 'R600018', 90, 7),
    ('execution', 'R600019', 90, 8),
    ('execution', 'R600022', 90, 9),
    ('execution', 'R600010', 85, 10),
    ('execution', 'R600005', 80, 11),
    ('execution', 'R600011', 80, 12),
    ('execution', 'R600016', 80, 13),
    ('execution', 'R600012', 75, 14),
    ('execution', 'R600023', 75, 15),
    ('execution', 'R600001', 70, 16),
    ('execution', 'R600006', 70, 17),
    ('execution', 'R600017', 70, 18),

    ('planning', 'R600001', 100, 1),
    ('planning', 'R600020', 100, 2),
    ('planning', 'R600025', 100, 3),
    ('planning', 'R600002', 90, 4),
    ('planning', 'R600003', 90, 5),
    ('planning', 'R600016', 90, 6),
    ('planning', 'R600017', 90, 7),
    ('planning', 'R600004', 80, 8),
    ('planning', 'R600014', 80, 9),
    ('planning', 'R600023', 80, 10),
    ('planning', 'R600019', 85, 11),

    ('principle', 'R600002', 100, 1),
    ('principle', 'R600003', 100, 2),
    ('principle', 'R600005', 100, 3),
    ('principle', 'R600016', 100, 4),
    ('principle', 'R600017', 100, 5),
    ('principle', 'R600019', 100, 6),
    ('principle', 'R600023', 100, 7),
    ('principle', 'R600011', 90, 8),
    ('principle', 'R600014', 90, 9),
    ('principle', 'R600015', 90, 10),
    ('principle', 'R600021', 90, 11),
    ('principle', 'R600006', 85, 12),
    ('principle', 'R600009', 80, 13),
    ('principle', 'R600022', 80, 14),
    ('principle', 'R600025', 80, 15),
    ('principle', 'R600018', 70, 16),

    ('flexibility', 'R600008', 100, 1),
    ('flexibility', 'R600012', 90, 2),
    ('flexibility', 'R600010', 80, 3),
    ('flexibility', 'R600013', 80, 4),
    ('flexibility', 'R600007', 75, 5),
    ('flexibility', 'R600018', 75, 6),
    ('flexibility', 'R600020', 75, 7),
    ('flexibility', 'R600004', 75, 8),
    ('flexibility', 'R600022', 70, 9),
    ('flexibility', 'R600024', 70, 10)
)
INSERT INTO public.personality_job_category_mappings (
  personality_type_id,
  job_category_id,
  fit_weight,
  reason,
  sort_order
)
SELECT
  personality_types.id,
  job_categories.id,
  mapping.fit_weight,
  CASE mapping.personality_code
    WHEN 'stability' THEN '예측 가능한 기준과 절차 안에서 꾸준히 성과를 내는 성향과 연결됩니다.'
    WHEN 'challenge' THEN '새로운 과제와 변화 속에서 기회를 찾는 성향을 살리기 좋습니다.'
    WHEN 'teamwork' THEN '사람들과 의견을 맞추고 함께 결과를 만드는 성향과 잘 맞습니다.'
    WHEN 'individual' THEN '독립적으로 집중하고 깊이 있게 판단하는 성향과 연결됩니다.'
    WHEN 'execution' THEN '현장에서 빠르게 움직이며 결과를 만드는 성향을 살리기 좋습니다.'
    WHEN 'planning' THEN '정보를 구조화하고 우선순위를 설계하는 성향과 잘 맞습니다.'
    WHEN 'principle' THEN '기준과 세부 조건을 정확하게 확인하는 성향과 연결됩니다.'
    WHEN 'flexibility' THEN '상황 변화에 맞춰 현실적인 대안을 찾는 성향을 살리기 좋습니다.'
  END,
  mapping.sort_order
FROM mapping
JOIN public.personality_types
  ON personality_types.code = mapping.personality_code
JOIN public.job_categories
  ON job_categories.source_code = mapping.category_code
ON CONFLICT (personality_type_id, job_category_id) DO UPDATE SET
  fit_weight = EXCLUDED.fit_weight,
  reason = EXCLUDED.reason,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE pg_namespace.nspname = 'public'
      AND pg_proc.proname = 'sync_job_posting_categories'
      AND pg_get_function_identity_arguments(pg_proc.oid) = ''
  ) THEN
    EXECUTE '
      CREATE FUNCTION public.sync_job_posting_categories()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        DELETE FROM public.job_posting_categories
        WHERE job_posting_id = NEW.id;

        INSERT INTO public.job_posting_categories (job_posting_id, job_category_id)
        SELECT DISTINCT NEW.id, categories.id
        FROM unnest(string_to_array(COALESCE(NEW.job_category, ''''), '','')) AS source_codes(source_code)
        JOIN public.job_categories categories
          ON categories.source_code = btrim(source_codes.source_code)
        WHERE categories.is_active = TRUE
        ON CONFLICT DO NOTHING;

        RETURN NEW;
      END;
      $fn$
    ';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_job_posting_categories ON public.job_postings;
CREATE TRIGGER trg_sync_job_posting_categories
AFTER INSERT OR UPDATE OF job_category
ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_posting_categories();

INSERT INTO public.job_posting_categories (job_posting_id, job_category_id)
SELECT DISTINCT postings.id, categories.id
FROM public.job_postings postings
CROSS JOIN LATERAL unnest(
  string_to_array(COALESCE(postings.job_category, ''), ',')
) AS source_codes(source_code)
JOIN public.job_categories categories
  ON categories.source_code = btrim(source_codes.source_code)
WHERE categories.is_active = TRUE
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_job_posting_categories_category
  ON public.job_posting_categories(job_category_id, job_posting_id);
CREATE INDEX IF NOT EXISTS idx_personality_job_categories_personality
  ON public.personality_job_category_mappings(personality_type_id, fit_weight DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_hot
  ON public.job_postings(is_active, is_featured DESC, view_count DESC, application_end_at);


-- ============================================================
-- Personality job categories: top 6 validation/order
-- ============================================================

-- 실행 추진형의 90점 동점군에서는 식품가공을 우선 노출한다.
-- 현장 절차에 따라 즉시 작업하고 결과물을 만드는 직무 특성을 반영하며,
-- 유형별 상위 6개만 노출해도 전체 25개 직무가 최소 한 번 포함되게 한다.
WITH execution_order(category_code, sort_order) AS (
  VALUES
    ('R600009', 1),  -- 운전·운송
    ('R600013', 2),  -- 음식서비스
    ('R600014', 3),  -- 건설
    ('R600015', 4),  -- 기계
    ('R600024', 5),  -- 농림어업
    ('R600021', 6),  -- 식품가공
    ('R600018', 7),  -- 섬유·의복
    ('R600019', 8),  -- 전기·전자
    ('R600022', 9),  -- 인쇄·목재·가구·공예
    ('R600010', 10), -- 영업·판매
    ('R600005', 11), -- 법률·경찰·소방·교도·국방
    ('R600011', 12), -- 경비·청소
    ('R600016', 13), -- 재료
    ('R600012', 14), -- 이용·숙박·여행·오락·스포츠
    ('R600023', 15), -- 환경·에너지·안전
    ('R600001', 16), -- 사업관리
    ('R600006', 17), -- 보건·의료
    ('R600017', 18)  -- 화학
)
UPDATE public.personality_job_category_mappings mappings
SET
  sort_order = execution_order.sort_order,
  updated_at = NOW()
FROM execution_order
JOIN public.job_categories categories
  ON categories.source_code = execution_order.category_code
JOIN public.personality_types personality_types
  ON personality_types.code = 'execution'
WHERE mappings.personality_type_id = personality_types.id
  AND mappings.job_category_id = categories.id;

-- 각 유형에 상위 6개가 존재하고, 그 합집합이 활성 직무 25개를 모두
-- 포함하는지 검증한다. 조건을 만족하지 않으면 적용을 중단한다.
DO $$
DECLARE
  invalid_type_count INTEGER;
  active_category_count INTEGER;
  covered_category_count INTEGER;
BEGIN
  WITH expected_types(code) AS (
    VALUES
      ('stability'),
      ('challenge'),
      ('teamwork'),
      ('individual'),
      ('execution'),
      ('planning'),
      ('principle'),
      ('flexibility')
  ),
  ranked AS (
    SELECT
      personality_types.code,
      ROW_NUMBER() OVER (
        PARTITION BY mappings.personality_type_id
        ORDER BY
          mappings.fit_weight DESC,
          mappings.sort_order ASC,
          categories.sort_order ASC
      ) AS display_rank
    FROM public.personality_job_category_mappings mappings
    JOIN public.personality_types personality_types
      ON personality_types.id = mappings.personality_type_id
    JOIN public.job_categories categories
      ON categories.id = mappings.job_category_id
     AND categories.is_active = TRUE
    WHERE personality_types.code IN (
      'stability',
      'challenge',
      'teamwork',
      'individual',
      'execution',
      'planning',
      'principle',
      'flexibility'
    )
  ),
  type_counts AS (
    SELECT code, COUNT(*) FILTER (WHERE display_rank <= 6) AS category_count
    FROM ranked
    GROUP BY code
  )
  SELECT COUNT(*)
  INTO invalid_type_count
  FROM expected_types
  LEFT JOIN type_counts USING (code)
  WHERE COALESCE(category_count, 0) <> 6;

  IF invalid_type_count <> 0 THEN
    RAISE EXCEPTION '유형별 추천 직무가 6개로 구성되지 않았습니다.';
  END IF;

  SELECT COUNT(*)
  INTO active_category_count
  FROM public.job_categories
  WHERE is_active = TRUE;

  WITH ranked AS (
    SELECT
      mappings.job_category_id,
      ROW_NUMBER() OVER (
        PARTITION BY mappings.personality_type_id
        ORDER BY
          mappings.fit_weight DESC,
          mappings.sort_order ASC,
          categories.sort_order ASC
      ) AS display_rank
    FROM public.personality_job_category_mappings mappings
    JOIN public.personality_types personality_types
      ON personality_types.id = mappings.personality_type_id
    JOIN public.job_categories categories
      ON categories.id = mappings.job_category_id
     AND categories.is_active = TRUE
    WHERE personality_types.code IN (
      'stability',
      'challenge',
      'teamwork',
      'individual',
      'execution',
      'planning',
      'principle',
      'flexibility'
    )
  )
  SELECT COUNT(DISTINCT job_category_id)
  INTO covered_category_count
  FROM ranked
  WHERE display_rank <= 6;

  IF covered_category_count <> active_category_count THEN
    RAISE EXCEPTION
      '상위 추천 직무에서 누락된 직무가 있습니다. 활성 %, 포함 %',
      active_category_count,
      covered_category_count;
  END IF;
END
$$;

-- 적용 결과 확인용 조회
WITH ranked AS (
  SELECT
    personality_types.code AS personality_code,
    personality_types.name AS personality_name,
    categories.name AS category_name,
    mappings.fit_weight,
    ROW_NUMBER() OVER (
      PARTITION BY mappings.personality_type_id
      ORDER BY
        mappings.fit_weight DESC,
        mappings.sort_order ASC,
        categories.sort_order ASC
    ) AS display_rank
  FROM public.personality_job_category_mappings mappings
  JOIN public.personality_types personality_types
    ON personality_types.id = mappings.personality_type_id
  JOIN public.job_categories categories
    ON categories.id = mappings.job_category_id
  WHERE categories.is_active = TRUE
)
SELECT
  personality_code,
  personality_name,
  display_rank,
  category_name,
  fit_weight
FROM ranked
WHERE display_rank <= 6
ORDER BY personality_code, display_rank;


-- ============================================================
-- Diagnosis result detail/history indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_diagnosis_results_type_created
  ON public.diagnosis_results(personality_type_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_result_user
  ON public.diagnosis_login_conversions(diagnosis_result_id, user_id);

CREATE INDEX IF NOT EXISTS idx_job_posting_categories_category_posting
  ON public.job_posting_categories(job_category_id, job_posting_id);

CREATE INDEX IF NOT EXISTS idx_job_postings_announcement_created
  ON public.job_postings(announcement_at DESC, created_at DESC);


-- ============================================================
-- Existing diagnosis anonymous-run user link backfill
-- ============================================================

WITH latest_conversion AS (
  SELECT DISTINCT ON (diagnosis_run_id)
    diagnosis_run_id,
    user_id
  FROM public.diagnosis_login_conversions
  ORDER BY diagnosis_run_id, created_at DESC, id DESC
)
UPDATE public.diagnosis_runs runs
SET user_id = conversions.user_id
FROM latest_conversion conversions
WHERE runs.id = conversions.diagnosis_run_id
  AND runs.user_id IS NULL;

UPDATE public.diagnosis_results results
SET user_id = runs.user_id
FROM public.diagnosis_runs runs
WHERE results.diagnosis_run_id = runs.id
  AND runs.user_id IS NOT NULL
  AND results.user_id IS DISTINCT FROM runs.user_id;

DELETE FROM public.user_sessions
WHERE expires_at <= NOW();


-- ============================================================
-- ALIO attachment URL correction
-- ============================================================

UPDATE public.job_posting_files
SET file_url =
  'https://www.alio.go.kr/download/download.json?fileNo=' ||
  substring(file_url FROM 'recrutAtchFileNo=([0-9]+)')
WHERE file_url LIKE 'https://opendata.alio.go.kr/recruit/downloadAtchFile%'
  AND substring(file_url FROM 'recrutAtchFileNo=([0-9]+)') IS NOT NULL;



