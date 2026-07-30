BEGIN;

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

COMMIT;
