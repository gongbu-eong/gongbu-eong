CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_files_user_created
  ON public.user_files(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_file_id UUID REFERENCES public.user_files(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'manual')),
  title TEXT NOT NULL,
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
  completion_percent SMALLINT NOT NULL DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100),
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  ADD COLUMN IF NOT EXISTS extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

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
  ELSE
    UPDATE public.user_resumes
    SET title = '이력서'
    WHERE title IS NULL;
  END IF;
END $$;

ALTER TABLE public.user_resumes
  ALTER COLUMN title SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_resumes'
      AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.user_resumes ALTER COLUMN file_name DROP NOT NULL;
  END IF;
END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_resumes_selected_one
  ON public.user_resumes(user_id)
  WHERE is_selected = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_resumes_user_created
  ON public.user_resumes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_resumes_user_title
  ON public.user_resumes(user_id, title);

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

CREATE INDEX IF NOT EXISTS idx_resume_parse_jobs_user_created
  ON public.resume_parse_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resume_parse_jobs_status_created
  ON public.resume_parse_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS public.user_resume_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  major TEXT,
  degree TEXT,
  start_date TEXT,
  end_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.user_resume_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  role TEXT,
  description TEXT,
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
  sort_order INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE IF EXISTS public.user_resume_awards
  ADD COLUMN IF NOT EXISTS issuer TEXT;

ALTER TABLE IF EXISTS public.user_resume_activities
  ADD COLUMN IF NOT EXISTS issuer TEXT;

ALTER TABLE IF EXISTS public.user_resume_languages
  ADD COLUMN IF NOT EXISTS issuer TEXT,
  ALTER COLUMN language_name DROP NOT NULL;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS selected_resume_id UUID;

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
