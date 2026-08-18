-- Blind resume update:
-- Remove personal/basic-info columns that are no longer used by /my/resumes.
-- Run this after deploying code that no longer reads or writes these columns.

ALTER TABLE public.user_resumes
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS birth_year,
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS desired_job;

-- Resume-related histories should stay even when the source resume is deleted.
-- Recreate resume FKs as ON DELETE SET NULL so delete does not fail.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'resume_coaching_requests'
      AND attr.attname = 'resume_id'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.resume_coaching_requests DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.resume_coaching_requests
    ADD CONSTRAINT resume_coaching_requests_resume_id_fkey
    FOREIGN KEY (resume_id)
    REFERENCES public.user_resumes(id)
    ON DELETE SET NULL;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'interview_coaching_sessions'
      AND attr.attname = 'resume_id'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.interview_coaching_sessions DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE public.interview_coaching_sessions
    ADD CONSTRAINT interview_coaching_sessions_resume_id_fkey
    FOREIGN KEY (resume_id)
    REFERENCES public.user_resumes(id)
    ON DELETE SET NULL;
END $$;

-- Keep one selected resume per user after the blind-resume migration.
-- Existing selections are preserved; users without a selected resume get their latest resume selected.
CREATE TEMP TABLE tmp_selected_resume_candidates ON COMMIT DROP AS
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY is_selected DESC, created_at DESC, id DESC
      ) AS row_number
    FROM public.user_resumes
  ) ranked
  WHERE row_number = 1;

UPDATE public.user_resumes
SET is_selected = FALSE;

UPDATE public.user_resumes resumes
SET is_selected = TRUE,
    updated_at = NOW()
FROM tmp_selected_resume_candidates selected_candidates
WHERE resumes.id = selected_candidates.id;

UPDATE public.users users
SET selected_resume_id = selected_resumes.id,
    updated_at = NOW()
FROM public.user_resumes selected_resumes
WHERE selected_resumes.user_id = users.id
  AND selected_resumes.is_selected = TRUE;

UPDATE public.users users
SET selected_resume_id = NULL,
    updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_resumes resumes
  WHERE resumes.user_id = users.id
);
