ALTER TABLE public.resume_coaching_requests
  ADD COLUMN IF NOT EXISTS input_type VARCHAR(20) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.user_files(id),
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS job_posting_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_resume_coaching_requests_user_created
  ON public.resume_coaching_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resume_coaching_requests_source_file
  ON public.resume_coaching_requests(source_file_id);
