BEGIN;

CREATE INDEX IF NOT EXISTS idx_diagnosis_results_type_created
  ON public.diagnosis_results(personality_type_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diagnosis_conversions_result_user
  ON public.diagnosis_login_conversions(diagnosis_result_id, user_id);

CREATE INDEX IF NOT EXISTS idx_job_posting_categories_category_posting
  ON public.job_posting_categories(job_category_id, job_posting_id);

CREATE INDEX IF NOT EXISTS idx_job_postings_announcement_created
  ON public.job_postings(announcement_at DESC, created_at DESC);

COMMIT;
