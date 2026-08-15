CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category varchar(40) NOT NULL,
  title varchar(120) NOT NULL,
  content text NOT NULL,
  image_data_url text,
  view_count integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction_type varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, reaction_type),
  CONSTRAINT community_post_reactions_type_check
    CHECK (reaction_type IN ('recommend', 'scrap'))
);

CREATE TABLE IF NOT EXISTS public.community_post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  file_name varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  file_size_bytes integer NOT NULL DEFAULT 0,
  file_data_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type varchar(20) NOT NULL,
  target_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason varchar(120),
  reason_code varchar(60),
  reason_detail text,
  status varchar(20) NOT NULL DEFAULT 'pending',
  target_snapshot jsonb,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT community_reports_target_type_check
    CHECK (target_type IN ('post', 'comment')),
  CONSTRAINT community_reports_status_check
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.community_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  query varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_search_terms (
  query varchar(80) PRIMARY KEY,
  search_count integer NOT NULL DEFAULT 0,
  last_searched_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS reason_code varchar(60),
  ADD COLUMN IF NOT EXISTS reason_detail text,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS target_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS community_posts_status_created_idx
  ON public.community_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_category_idx
  ON public.community_posts(category);
CREATE INDEX IF NOT EXISTS community_comments_post_idx
  ON public.community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS community_comments_active_post_idx
  ON public.community_comments(post_id, created_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS community_reactions_user_idx
  ON public.community_post_reactions(user_id, reaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS community_reactions_post_type_idx
  ON public.community_post_reactions(post_id, reaction_type);
CREATE INDEX IF NOT EXISTS community_attachments_post_idx
  ON public.community_post_attachments(post_id, sort_order, created_at);
DROP INDEX IF EXISTS public.community_reports_unique_post_idx;
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_unique_target_idx
  ON public.community_reports(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS community_reports_status_idx
  ON public.community_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_search_logs_query_idx
  ON public.community_search_logs(query, created_at DESC);
CREATE INDEX IF NOT EXISTS community_search_terms_count_idx
  ON public.community_search_terms(search_count DESC, last_searched_at DESC);

CREATE OR REPLACE VIEW public.community_report_target_summary AS
SELECT
  reports.target_type,
  reports.target_id,
  COUNT(*)::integer AS report_count,
  COUNT(*) FILTER (WHERE reports.status = 'pending')::integer AS pending_count,
  COUNT(*) FILTER (WHERE reports.status = 'reviewing')::integer AS reviewing_count,
  COUNT(*) FILTER (WHERE reports.status = 'resolved')::integer AS resolved_count,
  COUNT(*) FILTER (WHERE reports.status = 'rejected')::integer AS rejected_count,
  MIN(reports.created_at) AS first_reported_at,
  MAX(reports.created_at) AS last_reported_at,
  jsonb_object_agg(reports.reason_code, reason_counts.reason_count)
    FILTER (WHERE reports.reason_code IS NOT NULL) AS reason_counts,
  (
    ARRAY_AGG(reports.target_snapshot ORDER BY reports.created_at DESC)
  )[1] AS latest_target_snapshot
FROM public.community_reports reports
LEFT JOIN LATERAL (
  SELECT COUNT(*)::integer AS reason_count
  FROM public.community_reports reason_reports
  WHERE reason_reports.target_type = reports.target_type
    AND reason_reports.target_id = reports.target_id
    AND reason_reports.reason_code = reports.reason_code
) reason_counts ON TRUE
GROUP BY reports.target_type, reports.target_id;
