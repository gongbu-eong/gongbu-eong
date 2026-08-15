ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_type varchar(40) NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source_type varchar(60),
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_source_idx
  ON public.notifications(source_type, source_id)
  WHERE source_type IS NOT NULL
    AND source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_source_unique_idx
  ON public.notifications(user_id, source_type, source_id)
  WHERE source_type IS NOT NULL
    AND source_id IS NOT NULL;

ALTER TABLE IF EXISTS public.notification_dispatch_queue
  ADD COLUMN IF NOT EXISTS in_app_notification_id uuid
    REFERENCES public.notifications(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.notifications;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
