ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS community_comments_parent_idx
  ON public.community_comments(parent_comment_id, created_at DESC)
  WHERE status = 'active';
