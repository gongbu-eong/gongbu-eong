CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.user_resumes
  ADD COLUMN IF NOT EXISTS birth_date text,
  ADD COLUMN IF NOT EXISTS gpa_score text,
  ADD COLUMN IF NOT EXISTS gpa_max text,
  ADD COLUMN IF NOT EXISTS graduation_status text,
  ADD COLUMN IF NOT EXISTS education_start_date text,
  ADD COLUMN IF NOT EXISTS education_end_date text;

ALTER TABLE public.user_resume_educations
  ADD COLUMN IF NOT EXISTS graduation_status text,
  ADD COLUMN IF NOT EXISTS gpa_score text,
  ADD COLUMN IF NOT EXISTS gpa_max text;

ALTER TABLE public.user_resume_experiences
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS duties text;

ALTER TABLE public.user_resume_certifications
  ADD COLUMN IF NOT EXISTS acquired_date text;

CREATE TABLE IF NOT EXISTS public.user_resume_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  contest_name text NOT NULL,
  award_name text,
  issuer text,
  awarded_date text,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_resume_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  activity_name text NOT NULL,
  description text,
  issuer text,
  activity_date text,
  start_date text,
  end_date text,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_resume_languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id uuid NOT NULL REFERENCES public.user_resumes(id) ON DELETE CASCADE,
  language_name text,
  test_name text,
  level_or_score text,
  issuer text,
  acquired_date text,
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.user_resume_awards
  ADD COLUMN IF NOT EXISTS issuer text;

ALTER TABLE IF EXISTS public.user_resume_activities
  ADD COLUMN IF NOT EXISTS issuer text;

ALTER TABLE IF EXISTS public.user_resume_languages
  ADD COLUMN IF NOT EXISTS issuer text,
  ALTER COLUMN language_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_resume_awards_resume_id ON public.user_resume_awards(resume_id);
CREATE INDEX IF NOT EXISTS idx_user_resume_activities_resume_id ON public.user_resume_activities(resume_id);
CREATE INDEX IF NOT EXISTS idx_user_resume_languages_resume_id ON public.user_resume_languages(resume_id);
