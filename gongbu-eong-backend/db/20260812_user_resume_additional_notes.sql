ALTER TABLE public.user_resumes
  ADD COLUMN IF NOT EXISTS additional_notes TEXT;
