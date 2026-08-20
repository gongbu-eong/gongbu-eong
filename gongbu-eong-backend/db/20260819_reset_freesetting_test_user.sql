-- Completely removes freesetting@naver.com so the next Kakao/Naver login
-- starts from the real new-signup path.
--
-- Target user:
--   id    = ba8155b2-1149-42ea-a1e5-d2c176922174
--   email = freesetting@naver.com
--
-- This deletes account data, OAuth links, sessions, diagnosis results,
-- resumes/files, AI coaching history, community activity, notifications,
-- credit/payment history, and finally the public.users row.
--
-- Job posting/batch source tables are intentionally preserved:
--   public.job_postings
--   public.job_posting_details
--   public.job_posting_files
--   public.job_posting_stages
--   public.job_posting_sync_runs
--   public.job_posting_view_events
--   public.job_posting_daily_stats

BEGIN;

CREATE TEMP TABLE _target_user (id uuid PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _target_user (id)
SELECT users.id
FROM public.users users
WHERE users.id = 'ba8155b2-1149-42ea-a1e5-d2c176922174'::uuid
   OR users.email = 'freesetting@naver.com';

CREATE TEMP TABLE _target_posts ON COMMIT DROP AS
SELECT posts.id
FROM public.community_posts posts
JOIN _target_user target ON target.id = posts.user_id;

CREATE TEMP TABLE _target_comments ON COMMIT DROP AS
WITH RECURSIVE comment_tree AS (
  SELECT comments.id
  FROM public.community_comments comments
  JOIN _target_user target ON target.id = comments.user_id
  UNION
  SELECT comments.id
  FROM public.community_comments comments
  JOIN _target_posts posts ON posts.id = comments.post_id
  UNION
  SELECT child.id
  FROM public.community_comments child
  JOIN comment_tree parent ON parent.id = child.parent_comment_id
)
SELECT id FROM comment_tree;

CREATE TEMP TABLE _target_search_counts ON COMMIT DROP AS
SELECT logs.query, COUNT(*)::integer AS count_to_remove
FROM public.community_search_logs logs
JOIN _target_user target ON target.id = logs.user_id
GROUP BY logs.query;

CREATE TEMP TABLE _target_runs ON COMMIT DROP AS
SELECT runs.id
FROM public.diagnosis_runs runs
JOIN _target_user target ON target.id = runs.user_id
UNION
SELECT conversions.diagnosis_run_id
FROM public.diagnosis_login_conversions conversions
JOIN _target_user target ON target.id = conversions.user_id;

CREATE TEMP TABLE _target_diagnosis_results ON COMMIT DROP AS
SELECT results.id
FROM public.diagnosis_results results
LEFT JOIN public.diagnosis_runs runs ON runs.id = results.diagnosis_run_id
LEFT JOIN public.diagnosis_login_conversions conversions ON conversions.diagnosis_result_id = results.id
JOIN _target_user target
  ON target.id = results.user_id
  OR target.id = runs.user_id
  OR target.id = conversions.user_id;

CREATE TEMP TABLE _target_resumes ON COMMIT DROP AS
SELECT resumes.id
FROM public.user_resumes resumes
JOIN _target_user target ON target.id = resumes.user_id;

CREATE TEMP TABLE _target_files ON COMMIT DROP AS
SELECT files.id
FROM public.user_files files
JOIN _target_user target ON target.id = files.user_id;

CREATE TEMP TABLE _target_applications ON COMMIT DROP AS
SELECT applications.id
FROM public.user_job_applications applications
JOIN _target_user target ON target.id = applications.user_id;

CREATE TEMP TABLE _target_coaching_requests ON COMMIT DROP AS
SELECT requests.id
FROM public.resume_coaching_requests requests
LEFT JOIN _target_resumes resumes ON resumes.id = requests.resume_id
JOIN _target_user target ON target.id = requests.user_id OR resumes.id IS NOT NULL;

CREATE TEMP TABLE _target_interview_sessions ON COMMIT DROP AS
SELECT sessions.id
FROM public.interview_coaching_sessions sessions
LEFT JOIN _target_resumes resumes ON resumes.id = sessions.resume_id
JOIN _target_user target ON target.id = sessions.user_id OR resumes.id IS NOT NULL;

CREATE TEMP TABLE _target_rejection_requests ON COMMIT DROP AS
SELECT requests.id
FROM public.rejection_analysis_requests requests
LEFT JOIN _target_applications applications ON applications.id = requests.application_id
JOIN _target_user target ON target.id = requests.user_id OR applications.id IS NOT NULL;

CREATE TEMP TABLE _target_payments ON COMMIT DROP AS
SELECT payments.id
FROM public.payments payments
JOIN _target_user target ON target.id = payments.user_id;

UPDATE public.users users
SET
  selected_diagnosis_result_id = NULL,
  selected_resume_id = NULL,
  updated_at = NOW()
FROM _target_user target
WHERE users.id = target.id;

UPDATE public.community_search_terms terms
SET
  search_count = GREATEST(0, terms.search_count - counts.count_to_remove),
  updated_at = NOW()
FROM _target_search_counts counts
WHERE terms.query = counts.query;

DELETE FROM public.community_search_terms
WHERE search_count <= 0
  AND query IN (SELECT query FROM _target_search_counts);

DO $$
BEGIN
  IF to_regclass('public.notification_dispatch_queue') IS NOT NULL THEN
    EXECUTE '
      DELETE FROM public.notification_dispatch_queue queue
      USING _target_user target
      WHERE queue.user_id = target.id
    ';
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE '
      DELETE FROM public.notifications notifications
      USING _target_user target
      WHERE notifications.user_id = target.id
    ';
  END IF;

  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    EXECUTE '
      DELETE FROM public.notification_preferences preferences
      USING _target_user target
      WHERE preferences.user_id = target.id
    ';
  END IF;
END $$;

DELETE FROM public.rejection_analysis_results results
USING _target_rejection_requests requests
WHERE results.request_id = requests.id;

DELETE FROM public.rejection_analysis_requests requests
USING _target_rejection_requests target_requests
WHERE requests.id = target_requests.id;

DELETE FROM public.user_job_bookmarks bookmarks
USING _target_user target
WHERE bookmarks.user_id = target.id;

DELETE FROM public.user_job_applications applications
USING _target_applications target_applications
WHERE applications.id = target_applications.id;

DELETE FROM public.user_calendar_items items
USING _target_user target
WHERE items.user_id = target.id;

DO $$
BEGIN
  IF to_regclass('public.job_posting_view_events') IS NOT NULL THEN
    EXECUTE '
      UPDATE public.job_posting_view_events events
      SET user_id = NULL
      FROM _target_user target
      WHERE events.user_id = target.id
    ';
  END IF;
END $$;

DELETE FROM public.community_reports reports
USING _target_user target
WHERE reports.user_id = target.id
   OR reports.reviewed_by = target.id
   OR (reports.target_type = 'post' AND reports.target_id IN (SELECT id FROM _target_posts))
   OR (reports.target_type = 'comment' AND reports.target_id IN (SELECT id FROM _target_comments));

DELETE FROM public.community_search_logs logs
USING _target_user target
WHERE logs.user_id = target.id;

DELETE FROM public.community_post_reactions reactions
USING _target_user target
WHERE reactions.user_id = target.id
   OR reactions.post_id IN (SELECT id FROM _target_posts);

DELETE FROM public.community_post_attachments attachments
USING _target_posts posts
WHERE attachments.post_id = posts.id;

DELETE FROM public.community_comments comments
USING _target_comments target_comments
WHERE comments.id = target_comments.id;

DELETE FROM public.community_posts posts
USING _target_posts target_posts
WHERE posts.id = target_posts.id;

DELETE FROM public.resume_coaching_results results
USING _target_coaching_requests requests
WHERE results.request_id = requests.id;

DELETE FROM public.resume_coaching_requests requests
USING _target_coaching_requests target_requests
WHERE requests.id = target_requests.id;

DELETE FROM public.interview_coaching_messages messages
USING _target_interview_sessions sessions
WHERE messages.session_id = sessions.id;

DELETE FROM public.interview_coaching_sessions sessions
USING _target_interview_sessions target_sessions
WHERE sessions.id = target_sessions.id;

DELETE FROM public.user_resume_educations educations
USING _target_resumes resumes
WHERE educations.resume_id = resumes.id;

DELETE FROM public.user_resume_experiences experiences
USING _target_resumes resumes
WHERE experiences.resume_id = resumes.id;

DELETE FROM public.user_resume_certifications certifications
USING _target_resumes resumes
WHERE certifications.resume_id = resumes.id;

DELETE FROM public.user_resume_awards awards
USING _target_resumes resumes
WHERE awards.resume_id = resumes.id;

DELETE FROM public.user_resume_activities activities
USING _target_resumes resumes
WHERE activities.resume_id = resumes.id;

DELETE FROM public.user_resume_languages languages
USING _target_resumes resumes
WHERE languages.resume_id = resumes.id;

DELETE FROM public.user_resumes resumes
USING _target_resumes target_resumes
WHERE resumes.id = target_resumes.id;

DELETE FROM public.resume_parse_jobs jobs
USING _target_user target
WHERE jobs.user_id = target.id;

DELETE FROM public.user_files files
USING _target_files target_files
WHERE files.id = target_files.id;

DELETE FROM public.diagnosis_recommended_job_postings recommendations
USING _target_diagnosis_results results
WHERE recommendations.diagnosis_result_id = results.id;

DO $$
BEGIN
  IF to_regclass('public.product_events') IS NOT NULL THEN
    EXECUTE '
      DELETE FROM public.product_events events
      USING _target_user target
      WHERE events.user_id = target.id
         OR events.diagnosis_run_id IN (SELECT id FROM _target_runs)
         OR events.diagnosis_result_id IN (SELECT id FROM _target_diagnosis_results)
    ';
  END IF;
END $$;

DELETE FROM public.diagnosis_login_conversions conversions
USING _target_user target
WHERE conversions.user_id = target.id
   OR conversions.diagnosis_run_id IN (SELECT id FROM _target_runs)
   OR conversions.diagnosis_result_id IN (SELECT id FROM _target_diagnosis_results);

DELETE FROM public.diagnosis_results results
USING _target_diagnosis_results target_results
WHERE results.id = target_results.id;

DELETE FROM public.diagnosis_answers answers
USING _target_runs runs
WHERE answers.diagnosis_run_id = runs.id;

DELETE FROM public.diagnosis_runs runs
USING _target_runs target_runs
WHERE runs.id = target_runs.id;

DELETE FROM public.credit_transactions transactions
USING _target_user target
WHERE transactions.user_id = target.id;

DELETE FROM public.payments payments
USING _target_payments target_payments
WHERE payments.id = target_payments.id;

DELETE FROM public.ai_usage_events events
USING _target_user target
WHERE events.user_id = target.id;

DELETE FROM public.support_inquiries inquiries
USING _target_user target
WHERE inquiries.user_id = target.id;

DELETE FROM public.user_profiles profiles
USING _target_user target
WHERE profiles.user_id = target.id;

DELETE FROM public.user_consents consents
USING _target_user target
WHERE consents.user_id = target.id;

DO $$
BEGIN
  IF to_regclass('public.user_attributions') IS NOT NULL THEN
    EXECUTE '
      DELETE FROM public.user_attributions attributions
      USING _target_user target
      WHERE attributions.user_id = target.id
    ';
  END IF;

  IF to_regclass('public.attribution_events') IS NOT NULL THEN
    EXECUTE '
      DELETE FROM public.attribution_events events
      USING _target_user target
      WHERE events.user_id = target.id
    ';
  END IF;
END $$;

DELETE FROM public.user_entry_events events
USING _target_user target
WHERE events.user_id = target.id;

DELETE FROM public.access_logs logs
USING _target_user target
WHERE logs.user_id = target.id;

DELETE FROM public.user_sessions sessions
USING _target_user target
WHERE sessions.user_id = target.id;

DELETE FROM public.auth_login_events events
USING _target_user target
WHERE events.user_id = target.id;

DELETE FROM public.user_oauth_accounts accounts
USING _target_user target
WHERE accounts.user_id = target.id;

DELETE FROM public.users users
USING _target_user target
WHERE users.id = target.id;

COMMIT;
