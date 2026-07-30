BEGIN;

-- 실행 추진형의 90점 동점군에서는 식품가공을 우선 노출한다.
-- 현장 절차에 따라 즉시 작업하고 결과물을 만드는 직무 특성을 반영하며,
-- 유형별 상위 6개만 노출해도 전체 25개 직무가 최소 한 번 포함되게 한다.
WITH execution_order(category_code, sort_order) AS (
  VALUES
    ('R600009', 1),  -- 운전·운송
    ('R600013', 2),  -- 음식서비스
    ('R600014', 3),  -- 건설
    ('R600015', 4),  -- 기계
    ('R600024', 5),  -- 농림어업
    ('R600021', 6),  -- 식품가공
    ('R600018', 7),  -- 섬유·의복
    ('R600019', 8),  -- 전기·전자
    ('R600022', 9),  -- 인쇄·목재·가구·공예
    ('R600010', 10), -- 영업·판매
    ('R600005', 11), -- 법률·경찰·소방·교도·국방
    ('R600011', 12), -- 경비·청소
    ('R600016', 13), -- 재료
    ('R600012', 14), -- 이용·숙박·여행·오락·스포츠
    ('R600023', 15), -- 환경·에너지·안전
    ('R600001', 16), -- 사업관리
    ('R600006', 17), -- 보건·의료
    ('R600017', 18)  -- 화학
)
UPDATE public.personality_job_category_mappings mappings
SET
  sort_order = execution_order.sort_order,
  updated_at = NOW()
FROM execution_order
JOIN public.job_categories categories
  ON categories.source_code = execution_order.category_code
JOIN public.personality_types personality_types
  ON personality_types.code = 'execution'
WHERE mappings.personality_type_id = personality_types.id
  AND mappings.job_category_id = categories.id;

-- 각 유형에 상위 6개가 존재하고, 그 합집합이 활성 직무 25개를 모두
-- 포함하는지 검증한다. 조건을 만족하지 않으면 적용을 중단한다.
DO $$
DECLARE
  invalid_type_count INTEGER;
  active_category_count INTEGER;
  covered_category_count INTEGER;
BEGIN
  WITH expected_types(code) AS (
    VALUES
      ('stability'),
      ('challenge'),
      ('teamwork'),
      ('individual'),
      ('execution'),
      ('planning'),
      ('principle'),
      ('flexibility')
  ),
  ranked AS (
    SELECT
      personality_types.code,
      ROW_NUMBER() OVER (
        PARTITION BY mappings.personality_type_id
        ORDER BY
          mappings.fit_weight DESC,
          mappings.sort_order ASC,
          categories.sort_order ASC
      ) AS display_rank
    FROM public.personality_job_category_mappings mappings
    JOIN public.personality_types personality_types
      ON personality_types.id = mappings.personality_type_id
    JOIN public.job_categories categories
      ON categories.id = mappings.job_category_id
     AND categories.is_active = TRUE
    WHERE personality_types.code IN (
      'stability',
      'challenge',
      'teamwork',
      'individual',
      'execution',
      'planning',
      'principle',
      'flexibility'
    )
  ),
  type_counts AS (
    SELECT code, COUNT(*) FILTER (WHERE display_rank <= 6) AS category_count
    FROM ranked
    GROUP BY code
  )
  SELECT COUNT(*)
  INTO invalid_type_count
  FROM expected_types
  LEFT JOIN type_counts USING (code)
  WHERE COALESCE(category_count, 0) <> 6;

  IF invalid_type_count <> 0 THEN
    RAISE EXCEPTION '유형별 추천 직무가 6개로 구성되지 않았습니다.';
  END IF;

  SELECT COUNT(*)
  INTO active_category_count
  FROM public.job_categories
  WHERE is_active = TRUE;

  WITH ranked AS (
    SELECT
      mappings.job_category_id,
      ROW_NUMBER() OVER (
        PARTITION BY mappings.personality_type_id
        ORDER BY
          mappings.fit_weight DESC,
          mappings.sort_order ASC,
          categories.sort_order ASC
      ) AS display_rank
    FROM public.personality_job_category_mappings mappings
    JOIN public.personality_types personality_types
      ON personality_types.id = mappings.personality_type_id
    JOIN public.job_categories categories
      ON categories.id = mappings.job_category_id
     AND categories.is_active = TRUE
    WHERE personality_types.code IN (
      'stability',
      'challenge',
      'teamwork',
      'individual',
      'execution',
      'planning',
      'principle',
      'flexibility'
    )
  )
  SELECT COUNT(DISTINCT job_category_id)
  INTO covered_category_count
  FROM ranked
  WHERE display_rank <= 6;

  IF covered_category_count <> active_category_count THEN
    RAISE EXCEPTION
      '상위 추천 직무에서 누락된 직무가 있습니다. 활성 %, 포함 %',
      active_category_count,
      covered_category_count;
  END IF;
END
$$;

COMMIT;

-- 적용 결과 확인용 조회
WITH ranked AS (
  SELECT
    personality_types.code AS personality_code,
    personality_types.name AS personality_name,
    categories.name AS category_name,
    mappings.fit_weight,
    ROW_NUMBER() OVER (
      PARTITION BY mappings.personality_type_id
      ORDER BY
        mappings.fit_weight DESC,
        mappings.sort_order ASC,
        categories.sort_order ASC
    ) AS display_rank
  FROM public.personality_job_category_mappings mappings
  JOIN public.personality_types personality_types
    ON personality_types.id = mappings.personality_type_id
  JOIN public.job_categories categories
    ON categories.id = mappings.job_category_id
  WHERE categories.is_active = TRUE
)
SELECT
  personality_code,
  personality_name,
  display_rank,
  category_name,
  fit_weight
FROM ranked
WHERE display_rank <= 6
ORDER BY personality_code, display_rank;
