BEGIN;

CREATE TABLE IF NOT EXISTS public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_posting_categories (
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  job_category_id UUID NOT NULL REFERENCES public.job_categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_posting_id, job_category_id)
);

CREATE TABLE IF NOT EXISTS public.personality_job_category_mappings (
  personality_type_id UUID NOT NULL REFERENCES public.personality_types(id) ON DELETE CASCADE,
  job_category_id UUID NOT NULL REFERENCES public.job_categories(id) ON DELETE CASCADE,
  fit_weight SMALLINT NOT NULL CHECK (fit_weight BETWEEN 1 AND 100),
  reason TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (personality_type_id, job_category_id)
);

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO public.job_categories (source_code, name, sort_order)
VALUES
  ('R600001', '사업관리', 1),
  ('R600002', '경영·회계·사무', 2),
  ('R600003', '금융·보험', 3),
  ('R600004', '교육·자연·사회과학', 4),
  ('R600005', '법률·경찰·소방·교도·국방', 5),
  ('R600006', '보건·의료', 6),
  ('R600007', '사회복지·종교', 7),
  ('R600008', '문화·예술·디자인·방송', 8),
  ('R600009', '운전·운송', 9),
  ('R600010', '영업·판매', 10),
  ('R600011', '경비·청소', 11),
  ('R600012', '이용·숙박·여행·오락·스포츠', 12),
  ('R600013', '음식서비스', 13),
  ('R600014', '건설', 14),
  ('R600015', '기계', 15),
  ('R600016', '재료', 16),
  ('R600017', '화학', 17),
  ('R600018', '섬유·의복', 18),
  ('R600019', '전기·전자', 19),
  ('R600020', '정보통신', 20),
  ('R600021', '식품가공', 21),
  ('R600022', '인쇄·목재·가구·공예', 22),
  ('R600023', '환경·에너지·안전', 23),
  ('R600024', '농림어업', 24),
  ('R600025', '연구', 25)
ON CONFLICT (source_code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

WITH mapping(personality_code, category_code, fit_weight, sort_order) AS (
  VALUES
    ('stability', 'R600011', 100, 1),
    ('stability', 'R600006', 90, 2),
    ('stability', 'R600023', 90, 3),
    ('stability', 'R600005', 85, 4),
    ('stability', 'R600009', 85, 5),
    ('stability', 'R600024', 85, 6),
    ('stability', 'R600002', 80, 7),
    ('stability', 'R600003', 80, 8),
    ('stability', 'R600021', 80, 9),
    ('stability', 'R600013', 65, 10),

    ('challenge', 'R600010', 100, 1),
    ('challenge', 'R600008', 90, 2),
    ('challenge', 'R600020', 85, 3),
    ('challenge', 'R600025', 85, 4),
    ('challenge', 'R600012', 80, 5),
    ('challenge', 'R600004', 75, 6),
    ('challenge', 'R600014', 70, 7),
    ('challenge', 'R600015', 70, 8),

    ('teamwork', 'R600006', 100, 1),
    ('teamwork', 'R600007', 100, 2),
    ('teamwork', 'R600012', 100, 3),
    ('teamwork', 'R600004', 95, 4),
    ('teamwork', 'R600010', 90, 5),
    ('teamwork', 'R600013', 90, 6),
    ('teamwork', 'R600001', 85, 7),
    ('teamwork', 'R600008', 75, 8),
    ('teamwork', 'R600005', 70, 9),

    ('individual', 'R600022', 100, 1),
    ('individual', 'R600020', 90, 2),
    ('individual', 'R600025', 90, 3),
    ('individual', 'R600018', 85, 4),
    ('individual', 'R600015', 80, 5),
    ('individual', 'R600016', 80, 6),
    ('individual', 'R600017', 80, 7),
    ('individual', 'R600024', 80, 8),
    ('individual', 'R600008', 80, 9),
    ('individual', 'R600019', 75, 10),
    ('individual', 'R600009', 70, 11),
    ('individual', 'R600002', 70, 12),

    ('execution', 'R600009', 100, 1),
    ('execution', 'R600013', 100, 2),
    ('execution', 'R600014', 100, 3),
    ('execution', 'R600015', 100, 4),
    ('execution', 'R600024', 100, 5),
    ('execution', 'R600021', 90, 6),
    ('execution', 'R600018', 90, 7),
    ('execution', 'R600019', 90, 8),
    ('execution', 'R600022', 90, 9),
    ('execution', 'R600010', 85, 10),
    ('execution', 'R600005', 80, 11),
    ('execution', 'R600011', 80, 12),
    ('execution', 'R600016', 80, 13),
    ('execution', 'R600012', 75, 14),
    ('execution', 'R600023', 75, 15),
    ('execution', 'R600001', 70, 16),
    ('execution', 'R600006', 70, 17),
    ('execution', 'R600017', 70, 18),

    ('planning', 'R600001', 100, 1),
    ('planning', 'R600020', 100, 2),
    ('planning', 'R600025', 100, 3),
    ('planning', 'R600002', 90, 4),
    ('planning', 'R600003', 90, 5),
    ('planning', 'R600016', 90, 6),
    ('planning', 'R600017', 90, 7),
    ('planning', 'R600004', 80, 8),
    ('planning', 'R600014', 80, 9),
    ('planning', 'R600023', 80, 10),
    ('planning', 'R600019', 85, 11),

    ('principle', 'R600002', 100, 1),
    ('principle', 'R600003', 100, 2),
    ('principle', 'R600005', 100, 3),
    ('principle', 'R600016', 100, 4),
    ('principle', 'R600017', 100, 5),
    ('principle', 'R600019', 100, 6),
    ('principle', 'R600023', 100, 7),
    ('principle', 'R600011', 90, 8),
    ('principle', 'R600014', 90, 9),
    ('principle', 'R600015', 90, 10),
    ('principle', 'R600021', 90, 11),
    ('principle', 'R600006', 85, 12),
    ('principle', 'R600009', 80, 13),
    ('principle', 'R600022', 80, 14),
    ('principle', 'R600025', 80, 15),
    ('principle', 'R600018', 70, 16),

    ('flexibility', 'R600008', 100, 1),
    ('flexibility', 'R600012', 90, 2),
    ('flexibility', 'R600010', 80, 3),
    ('flexibility', 'R600013', 80, 4),
    ('flexibility', 'R600007', 75, 5),
    ('flexibility', 'R600018', 75, 6),
    ('flexibility', 'R600020', 75, 7),
    ('flexibility', 'R600004', 75, 8),
    ('flexibility', 'R600022', 70, 9),
    ('flexibility', 'R600024', 70, 10)
)
INSERT INTO public.personality_job_category_mappings (
  personality_type_id,
  job_category_id,
  fit_weight,
  reason,
  sort_order
)
SELECT
  personality_types.id,
  job_categories.id,
  mapping.fit_weight,
  CASE mapping.personality_code
    WHEN 'stability' THEN '예측 가능한 기준과 절차 안에서 꾸준히 성과를 내는 성향과 연결됩니다.'
    WHEN 'challenge' THEN '새로운 과제와 변화 속에서 기회를 찾는 성향을 살리기 좋습니다.'
    WHEN 'teamwork' THEN '사람들과 의견을 맞추고 함께 결과를 만드는 성향과 잘 맞습니다.'
    WHEN 'individual' THEN '독립적으로 집중하고 깊이 있게 판단하는 성향과 연결됩니다.'
    WHEN 'execution' THEN '현장에서 빠르게 움직이며 결과를 만드는 성향을 살리기 좋습니다.'
    WHEN 'planning' THEN '정보를 구조화하고 우선순위를 설계하는 성향과 잘 맞습니다.'
    WHEN 'principle' THEN '기준과 세부 조건을 정확하게 확인하는 성향과 연결됩니다.'
    WHEN 'flexibility' THEN '상황 변화에 맞춰 현실적인 대안을 찾는 성향을 살리기 좋습니다.'
  END,
  mapping.sort_order
FROM mapping
JOIN public.personality_types
  ON personality_types.code = mapping.personality_code
JOIN public.job_categories
  ON job_categories.source_code = mapping.category_code
ON CONFLICT (personality_type_id, job_category_id) DO UPDATE SET
  fit_weight = EXCLUDED.fit_weight,
  reason = EXCLUDED.reason,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.sync_job_posting_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.job_posting_categories
  WHERE job_posting_id = NEW.id;

  INSERT INTO public.job_posting_categories (job_posting_id, job_category_id)
  SELECT DISTINCT NEW.id, categories.id
  FROM unnest(string_to_array(COALESCE(NEW.job_category, ''), ',')) AS source_codes(source_code)
  JOIN public.job_categories categories
    ON categories.source_code = btrim(source_codes.source_code)
  WHERE categories.is_active = TRUE
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_posting_categories ON public.job_postings;
CREATE TRIGGER trg_sync_job_posting_categories
AFTER INSERT OR UPDATE OF job_category
ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_posting_categories();

INSERT INTO public.job_posting_categories (job_posting_id, job_category_id)
SELECT DISTINCT postings.id, categories.id
FROM public.job_postings postings
CROSS JOIN LATERAL unnest(
  string_to_array(COALESCE(postings.job_category, ''), ',')
) AS source_codes(source_code)
JOIN public.job_categories categories
  ON categories.source_code = btrim(source_codes.source_code)
WHERE categories.is_active = TRUE
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_job_posting_categories_category
  ON public.job_posting_categories(job_category_id, job_posting_id);
CREATE INDEX IF NOT EXISTS idx_personality_job_categories_personality
  ON public.personality_job_category_mappings(personality_type_id, fit_weight DESC);
CREATE INDEX IF NOT EXISTS idx_job_postings_hot
  ON public.job_postings(is_active, is_featured DESC, view_count DESC, application_end_at);

COMMIT;
