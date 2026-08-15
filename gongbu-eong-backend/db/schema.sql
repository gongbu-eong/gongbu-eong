DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
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

CREATE TABLE IF NOT EXISTS public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT,
  extracted_text TEXT,
  user_file_id UUID,
  source_type TEXT NOT NULL DEFAULT 'manual',
  title TEXT,
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
  resume_id UUID REFERENCES public.user_resumes(id),
  prompt_text TEXT,
  input_text TEXT NOT NULL,
  entry_source public.entry_source NOT NULL DEFAULT 'unknown',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  resume_id UUID REFERENCES public.user_resumes(id),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  board_id UUID NOT NULL REFERENCES public.community_boards(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status public.post_status NOT NULL DEFAULT 'published',
  view_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  parent_comment_id UUID REFERENCES public.community_comments(id),
  content TEXT NOT NULL,
  status public.post_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  reaction_type VARCHAR(30) NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id),
  application_deadline_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  application_deadline_days_before INTEGER NOT NULL DEFAULT 3,
  tailored_job_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  kakao_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_job_postings_end_at ON public.job_postings(application_end_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_institution ON public.job_postings(institution_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_region_category ON public.job_postings(work_region, job_category);
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
DO $$
BEGIN
  IF to_regclass('public.job_posting_categories') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_job_posting_categories_category_posting
      ON public.job_posting_categories(job_category_id, job_posting_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_job_postings_announcement_created ON public.job_postings(announcement_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_user_created ON public.user_resumes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_board_created ON public.community_posts(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users',
    'user_oauth_accounts',
    'user_profiles',
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

INSERT INTO public.credit_packages (name, credit_amount, bonus_credit_amount, price_krw)
VALUES
  ('15크레딧', 15, 0, 4900),
  ('30크레딧', 30, 5, 9900),
  ('60크레딧', 60, 15, 19900)
ON CONFLICT DO NOTHING;
