-- Speeds up rolling 24-hour popular community search keyword aggregation.
CREATE INDEX IF NOT EXISTS community_search_logs_query_created_idx
  ON public.community_search_logs(query, created_at DESC);

CREATE INDEX IF NOT EXISTS community_search_logs_created_query_idx
  ON public.community_search_logs(created_at DESC, query);
