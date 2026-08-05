ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS selected_diagnosis_result_id UUID;

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

WITH user_results AS (
  SELECT
    owners.user_id,
    results.id AS result_id,
    COALESCE(runs.completed_at, results.created_at) AS completed_at,
    results.created_at
  FROM public.diagnosis_results results
  JOIN public.diagnosis_runs runs
    ON runs.id = results.diagnosis_run_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      results.user_id,
      runs.user_id,
      (
        SELECT conversions.user_id
        FROM public.diagnosis_login_conversions conversions
        WHERE conversions.diagnosis_result_id = results.id
        ORDER BY conversions.created_at DESC
        LIMIT 1
      )
    ) AS user_id
  ) owners
  WHERE owners.user_id IS NOT NULL
),
latest_results AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    result_id
  FROM user_results
  ORDER BY user_id, completed_at DESC NULLS LAST, created_at DESC, result_id DESC
)
UPDATE public.users users
SET
  selected_diagnosis_result_id = latest_results.result_id,
  updated_at = NOW()
FROM latest_results
WHERE users.id = latest_results.user_id
  AND users.selected_diagnosis_result_id IS NULL;
