ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS application_deadline_days_before_list integer[] NOT NULL DEFAULT ARRAY[3]::integer[],
  ADD COLUMN IF NOT EXISTS kakao_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_revoked_at timestamptz;

UPDATE public.notification_preferences
SET application_deadline_days_before_list = ARRAY[application_deadline_days_before]::integer[]
WHERE application_deadline_days_before_list IS NULL
   OR cardinality(application_deadline_days_before_list) = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_preferences_deadline_offsets_check'
  ) THEN
    ALTER TABLE public.notification_preferences
      ADD CONSTRAINT notification_preferences_deadline_offsets_check
      CHECK (
        application_deadline_days_before_list <@ ARRAY[0, 3, 7]::integer[]
        AND cardinality(application_deadline_days_before_list) >= 1
      ) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE CASCADE,
  channel varchar(20) NOT NULL,
  purpose varchar(40) NOT NULL,
  recipient varchar(30) NOT NULL,
  template_code varchar(80),
  title varchar(120) NOT NULL,
  message text NOT NULL,
  target_path text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending',
  external_message_id varchar(120),
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT NOW(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_dispatch_queue_channel_check
    CHECK (channel IN ('kakao_alimtalk', 'sms', 'in_app')),
  CONSTRAINT notification_dispatch_queue_purpose_check
    CHECK (purpose IN ('job_deadline', 'marketing', 'system')),
  CONSTRAINT notification_dispatch_queue_status_check
    CHECK (status IN ('pending', 'queued', 'sent', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.notification_dispatch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'running',
  target_date date,
  queued_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_dispatch_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS notification_dispatch_queue_pending_idx
  ON public.notification_dispatch_queue(status, scheduled_at)
  WHERE status IN ('pending', 'queued');

CREATE INDEX IF NOT EXISTS notification_dispatch_queue_user_created_idx
  ON public.notification_dispatch_queue(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS notification_dispatch_deadline_unique_idx
  ON public.notification_dispatch_queue(
    user_id,
    job_posting_id,
    purpose,
    (payload ->> 'offsetDays')
  )
  WHERE purpose = 'job_deadline'
    AND status <> 'cancelled';

DROP TRIGGER IF EXISTS set_updated_at ON public.notification_dispatch_queue;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notification_dispatch_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
