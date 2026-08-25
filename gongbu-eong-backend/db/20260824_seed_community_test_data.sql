-- Community test data reset + seed
--
-- What this script does:
-- 1. Removes current community posts/comments and dependent community data.
-- 2. Creates deterministic test-only authors with real-looking reserved nicknames.
-- 3. Inserts 102 community posts by at least 80 different-looking authors.
-- 4. Inserts comments for about 96% of posts:
--    - 4 posts have no comments.
--    - The rest have 1-10 top-level comments.
-- 5. Inserts replies on a realistic subset of top-level comments:
--    - Most comments have no replies.
--    - Some posts have reply clusters spread across several comments, including
--      long paging-test threads without concentrating every reply on one comment.
-- 6. Inserts recent popular search terms related to public-sector exam prep.
--
-- Notes:
-- - Existing real users are not deleted.
-- - Only sample users whose email starts with community-seed- are replaced.
-- - Seed community nicknames are intentionally real-looking and reserved in
--   public.users.community_nickname as active users, so duplicate nickname
--   checks catch them.
-- - Attachment size policy is irrelevant here because this seed does not add files.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Keep a stable copy of existing community target IDs before deleting.
CREATE TEMP TABLE _community_seed_target_posts ON COMMIT DROP AS
SELECT id FROM public.community_posts;

CREATE TEMP TABLE _community_seed_target_comments ON COMMIT DROP AS
SELECT id FROM public.community_comments;

-- Delete dependent community data first. community_boards are master data and are kept.
DELETE FROM public.community_reports
WHERE (target_type = 'post' AND target_id IN (SELECT id FROM _community_seed_target_posts))
   OR (target_type = 'comment' AND target_id IN (SELECT id FROM _community_seed_target_comments));

DELETE FROM public.community_comment_reactions;
DELETE FROM public.community_post_reactions;
DELETE FROM public.community_post_attachments;
DELETE FROM public.community_comments;
DELETE FROM public.community_posts;
DELETE FROM public.community_search_logs;
DELETE FROM public.community_search_terms;

-- Replace only previous seed authors.
CREATE TEMP TABLE _community_seed_author_ids ON COMMIT DROP AS
SELECT id
FROM public.users
WHERE email::text LIKE 'community-seed-%@example.local';

UPDATE public.users users
SET selected_diagnosis_result_id = NULL
FROM _community_seed_author_ids seed_users
WHERE users.id = seed_users.id;

CREATE TEMP TABLE _community_seed_run_ids ON COMMIT DROP AS
SELECT runs.id
FROM public.diagnosis_runs runs
JOIN _community_seed_author_ids seed_users ON seed_users.id = runs.user_id;

DELETE FROM public.diagnosis_recommended_job_postings recommendations
USING public.diagnosis_results results
WHERE recommendations.diagnosis_result_id = results.id
  AND results.user_id IN (SELECT id FROM _community_seed_author_ids);

DELETE FROM public.diagnosis_login_conversions conversions
WHERE conversions.user_id IN (SELECT id FROM _community_seed_author_ids)
   OR conversions.diagnosis_run_id IN (SELECT id FROM _community_seed_run_ids)
   OR conversions.diagnosis_result_id IN (
      SELECT id FROM public.diagnosis_results WHERE user_id IN (SELECT id FROM _community_seed_author_ids)
   );

DELETE FROM public.diagnosis_results results
WHERE results.user_id IN (SELECT id FROM _community_seed_author_ids)
   OR results.diagnosis_run_id IN (SELECT id FROM _community_seed_run_ids);

DELETE FROM public.diagnosis_answers answers
WHERE answers.diagnosis_run_id IN (SELECT id FROM _community_seed_run_ids);

DELETE FROM public.diagnosis_runs runs
WHERE runs.id IN (SELECT id FROM _community_seed_run_ids);

DELETE FROM public.users
WHERE email::text LIKE 'community-seed-%@example.local';

CREATE TEMP TABLE _community_seed_users (
  seq INTEGER PRIMARY KEY,
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  nickname VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  community_nickname VARCHAR(12) NOT NULL,
  profile_status_message VARCHAR(30) NOT NULL,
  profile_avatar_key VARCHAR(30) NOT NULL,
  profile_background_color VARCHAR(20) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  age_group VARCHAR(20) NOT NULL,
  tone_key VARCHAR(20) NOT NULL,
  diagnosis_code VARCHAR(50) NOT NULL
) ON COMMIT DROP;

INSERT INTO _community_seed_users (
  seq,
  nickname,
  display_name,
  community_nickname,
  profile_status_message,
  profile_avatar_key,
  profile_background_color,
  gender,
  age_group,
  tone_key,
  diagnosis_code
)
VALUES
  (1, '공부엉이', '공부엉이', '공부엉이', '첫 가입 환영합니다', 'fox', '#c6d5ff', 'female', 'early_20s', 'young', 'challenge'),
  (2, '민', '민', '민', '오늘도 한 문제', 'monkey', '#d1c2ff', 'male', 'early_20s', 'young', 'execution'),
  (3, '봄', '봄', '봄', '천천히 준비 중', 'penguin', '#c7ecdc', 'female', 'early_20s', 'young', 'teamwork'),
  (4, '솔', '솔', '솔', 'NCS 다시 시작', 'cat', '#b9c9ff', 'male', 'early_20s', 'young', 'individual'),
  (5, '준', '준', '준', '필기부터 차근차근', 'bear', '#c4c6ca', 'male', 'late_20s', 'young', 'planning'),
  (6, '현', '현', '현', '스터디 구해요', 'cow', '#c7ecdc', 'female', 'late_20s', 'young', 'principle'),
  (7, '은', '은', '은', '면접 복기 저장', 'chick', '#f5d2b0', 'female', 'late_20s', 'young', 'flexibility'),
  (8, '별', '별', '별', '오늘도 출석', 'fox', '#c6d5ff', 'male', 'late_20s', 'young', 'stability'),
  (9, '달', '달', '달', '공고 체크 중', 'penguin', '#d1c2ff', 'female', 'late_20s', 'young', 'challenge'),
  (10, '온', '온', '온', '합격까지 버티기', 'bear', '#c9d6d8', 'male', 'late_20s', 'young', 'execution'),
  (11, '하늘', '하늘', '하늘', '계획형 취준생', 'cat', '#c7ecdc', 'female', 'early_30s', 'plain', 'planning'),
  (12, '바다', '바다', '바다', '공기업 준비 2년차', 'cow', '#c4c6ca', 'male', 'early_30s', 'plain', 'principle'),
  (13, '노을', '노을', '노을', '서류부터 정리', 'monkey', '#f5d2b0', 'female', 'early_30s', 'plain', 'stability'),
  (14, '루나', '루나', '루나', '자소서 다듬는 중', 'bear', '#c9d6d8', 'female', 'early_30s', 'plain', 'teamwork'),
  (15, '모아', '모아', '모아', '자료 모으는 중', 'lion', '#f5bfd9', 'female', 'early_30s', 'plain', 'individual'),
  (16, '이든', '이든', '이든', '전공 회독 중', 'chicken', '#c4c6ca', 'male', 'early_30s', 'plain', 'flexibility'),
  (17, '도윤', '도윤', '도윤', '오답노트 작성', 'fox', '#c6d5ff', 'male', 'early_30s', 'plain', 'execution'),
  (18, '서아', '서아', '서아', '면접 준비 중', 'cat', '#b9c9ff', 'female', 'early_30s', 'plain', 'teamwork'),
  (19, '윤호', '윤호', '윤호', '필기 재도전', 'bear', '#c4c6ca', 'male', 'late_30s', 'mature', 'challenge'),
  (20, '지안', '지안', '지안', '차분히 준비 중', 'penguin', '#d1c2ff', 'female', 'late_30s', 'mature', 'stability'),
  (21, '태오', '태오', '태오', '공고 분석 좋아함', 'cow', '#c7ecdc', 'male', 'late_30s', 'mature', 'planning'),
  (22, '라온', '라온', '라온', '스터디 기록용', 'chick', '#f5d2b0', 'female', 'late_30s', 'mature', 'principle'),
  (23, '나래', '나래', '나래', '경험 공유합니다', 'fox', '#c6d5ff', 'female', 'late_30s', 'mature', 'flexibility'),
  (24, '시우', '시우', '시우', '기본기 다시 보기', 'bear', '#c9d6d8', 'male', 'late_30s', 'mature', 'individual'),
  (25, '은호', '은호', '은호', '면접 질문 정리', 'cat', '#c7ecdc', 'male', 'late_30s', 'mature', 'teamwork'),
  (26, '유진', '유진', '유진', '꾸준히 갑니다', 'monkey', '#f5d2b0', 'female', 'late_30s', 'mature', 'stability'),
  (27, 'Jay', 'Jay', 'Jay', 'NCS daily', 'fox', '#c6d5ff', 'male', 'early_20s', 'young', 'challenge'),
  (28, 'Mina', 'Mina', 'Mina', 'study log', 'cat', '#b9c9ff', 'female', 'early_20s', 'young', 'execution'),
  (29, 'Navi', 'Navi', 'Navi', 'job hunter', 'penguin', '#d1c2ff', 'female', 'late_20s', 'young', 'flexibility'),
  (30, 'Rookie', 'Rookie', 'Rookie', 'new start', 'chick', '#f5d2b0', 'male', 'late_20s', 'young', 'challenge'),
  (31, 'NcsMate', 'NcsMate', 'NcsMate', 'timer on', 'bear', '#c4c6ca', 'female', 'late_20s', 'young', 'planning'),
  (32, 'BluePen', 'BluePen', 'BluePen', 'notes only', 'cow', '#c7ecdc', 'male', 'late_20s', 'young', 'principle'),
  (33, 'Hopeful', 'Hopeful', 'Hopeful', 'keep going', 'fox', '#c6d5ff', 'female', 'early_30s', 'plain', 'teamwork'),
  (34, 'CalmLee', 'CalmLee', 'CalmLee', 'steady mode', 'bear', '#c9d6d8', 'male', 'early_30s', 'plain', 'stability'),
  (35, 'ReadyKim', 'ReadyKim', 'ReadyKim', 'ready today', 'cat', '#c7ecdc', 'female', 'early_30s', 'plain', 'execution'),
  (36, 'PlanB', 'PlanB', 'PlanB', 'backup plan', 'monkey', '#f5d2b0', 'male', 'early_30s', 'plain', 'planning'),
  (37, 'PublicOne', 'PublicOne', 'PublicOne', 'public service', 'penguin', '#d1c2ff', 'female', 'late_30s', 'mature', 'principle'),
  (38, 'FocusHan', 'FocusHan', 'FocusHan', 'deep focus', 'bear', '#c4c6ca', 'male', 'late_30s', 'mature', 'individual'),
  (39, 'BrightDay', 'BrightDay', 'BrightDay', 'one more try', 'chick', '#f5d2b0', 'female', 'late_30s', 'mature', 'flexibility'),
  (40, 'SteadyGo', 'SteadyGo', 'SteadyGo', 'slow wins', 'cow', '#c7ecdc', 'male', 'late_30s', 'mature', 'stability'),
  (41, '길', '길', '길', '방향 잡는 중', 'fox', '#c6d5ff', 'male', 'over_40', 'senior', 'planning'),
  (42, '강', '강', '강', '차분히 봅니다', 'bear', '#c9d6d8', 'male', 'over_40', 'senior', 'principle'),
  (43, '빛', '빛', '빛', '도움 되길', 'cat', '#c7ecdc', 'female', 'over_40', 'senior', 'teamwork'),
  (44, '숲', '숲', '숲', '기록합니다', 'monkey', '#f5d2b0', 'female', 'over_40', 'senior', 'stability'),
  (45, '돌', '돌', '돌', '기본이 답', 'bear', '#c4c6ca', 'male', 'over_40', 'senior', 'individual'),
  (46, '린', '린', '린', '다시 도전', 'penguin', '#d1c2ff', 'female', 'over_40', 'senior', 'challenge'),
  (47, '결', '결', '결', '끝까지 갑니다', 'chicken', '#f5bfd9', 'male', 'over_40', 'senior', 'execution'),
  (48, '찬', '찬', '찬', '조용히 공부', 'cow', '#c7ecdc', 'male', 'over_40', 'senior', 'flexibility'),
  (49, '라미', '라미', '라미', '스터디 찾는 중', 'fox', '#c6d5ff', 'female', 'early_20s', 'young', 'teamwork'),
  (50, '쿠키', '쿠키', '쿠키', '당 충전 필요', 'chick', '#f5d2b0', 'female', 'early_20s', 'young', 'flexibility'),
  (51, '제로', '제로', '제로', '처음부터 다시', 'bear', '#c4c6ca', 'male', 'early_20s', 'young', 'challenge'),
  (52, '모듈', '모듈', '모듈', '모듈형 싫어요', 'cat', '#b9c9ff', 'male', 'late_20s', 'young', 'individual'),
  (53, '오답왕', '오답왕', '오답왕', '틀려도 기록', 'monkey', '#f5d2b0', 'female', 'late_20s', 'young', 'principle'),
  (54, '면접러', '면접러', '면접러', '말 연습 중', 'penguin', '#d1c2ff', 'male', 'late_20s', 'young', 'execution'),
  (55, '공채봄', '공채봄', '공채봄', '공채 기다림', 'fox', '#c6d5ff', 'female', 'early_30s', 'plain', 'planning'),
  (56, '필기러', '필기러', '필기러', '필기 집중', 'bear', '#c4c6ca', 'male', 'early_30s', 'plain', 'stability'),
  (57, '서류맵', '서류맵', '서류맵', '서류 지도', 'cat', '#c7ecdc', 'female', 'early_30s', 'plain', 'principle'),
  (58, '면접맵', '면접맵', '면접맵', '면접 지도', 'cow', '#c9d6d8', 'male', 'early_30s', 'plain', 'teamwork'),
  (59, '서른길', '서른길', '서른길', '늦지 않았음', 'monkey', '#f5d2b0', 'female', 'late_30s', 'mature', 'challenge'),
  (60, '정리왕', '정리왕', '정리왕', '표로 정리', 'penguin', '#d1c2ff', 'male', 'late_30s', 'mature', 'planning'),
  (61, '루틴러', '루틴러', '루틴러', '루틴 유지', 'bear', '#c4c6ca', 'female', 'late_30s', 'mature', 'stability'),
  (62, '공준생', '공준생', '공준생', '공기업 준비', 'fox', '#c6d5ff', 'male', 'late_30s', 'mature', 'execution'),
  (63, '면접노트', '면접노트', '면접노트', '복기 저장', 'cat', '#c7ecdc', 'female', 'over_40', 'senior', 'teamwork'),
  (64, '채용읽기', '채용읽기', '채용읽기', '공고 꼼꼼히', 'cow', '#c9d6d8', 'male', 'over_40', 'senior', 'principle'),
  (65, '공공길', '공공길', '공공길', '공공의 길', 'bear', '#c4c6ca', 'female', 'over_40', 'senior', 'stability'),
  (66, '기본맨', '기본맨', '기본맨', '기본부터', 'monkey', '#f5d2b0', 'male', 'over_40', 'senior', 'individual'),
  (67, 'DocuKing', 'DocuKing', 'DocuKing', 'docs first', 'fox', '#c6d5ff', 'male', 'early_30s', 'plain', 'principle'),
  (68, 'InterviewQ', 'InterviewQ', 'InterviewQ', 'q bank', 'penguin', '#d1c2ff', 'female', 'early_30s', 'plain', 'teamwork'),
  (69, 'TimerOn', 'TimerOn', 'TimerOn', 'timer ready', 'chick', '#f5d2b0', 'male', 'late_20s', 'young', 'execution'),
  (70, 'PassNote', 'PassNote', 'PassNote', 'pass note', 'cat', '#b9c9ff', 'female', 'late_20s', 'young', 'planning'),
  (71, 'JobReader', 'JobReader', 'JobReader', 'read first', 'bear', '#c4c6ca', 'male', 'late_30s', 'mature', 'individual'),
  (72, 'EssayFix', 'EssayFix', 'EssayFix', 'rewrite', 'cow', '#c7ecdc', 'female', 'late_30s', 'mature', 'flexibility'),
  (73, 'PublicBee', 'PublicBee', 'PublicBee', 'busy bee', 'monkey', '#f5d2b0', 'female', 'early_20s', 'young', 'challenge'),
  (74, 'StudyMoon', 'StudyMoon', 'StudyMoon', 'night study', 'penguin', '#d1c2ff', 'male', 'early_20s', 'young', 'stability'),
  (75, 'BlueNCS', 'BlueNCS', 'BlueNCS', 'blue book', 'fox', '#c6d5ff', 'female', 'early_30s', 'plain', 'planning'),
  (76, 'GreenPass', 'GreenPass', 'GreenPass', 'green pass', 'cat', '#c7ecdc', 'male', 'early_30s', 'plain', 'teamwork'),
  (77, 'CalmPublic', 'CalmPublic', 'CalmPublic', 'calm public', 'bear', '#c4c6ca', 'female', 'over_40', 'senior', 'principle'),
  (78, 'WarmOffice', 'WarmOffice', 'WarmOffice', 'office dream', 'cow', '#c9d6d8', 'male', 'over_40', 'senior', 'stability'),
  (79, 'FinalTry', 'FinalTry', 'FinalTry', 'last push', 'chick', '#f5d2b0', 'female', 'late_20s', 'young', 'execution'),
  (80, 'QuietWin', 'QuietWin', 'QuietWin', 'quiet win', 'monkey', '#f5d2b0', 'male', 'late_30s', 'mature', 'individual');

INSERT INTO public.users (
  id,
  email,
  nickname,
  display_name,
  community_nickname,
  profile_status_message,
  profile_avatar_key,
  profile_background_color,
  gender,
  age_group,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  ('community-seed-' || seq || '@example.local')::citext,
  nickname,
  display_name,
  community_nickname,
  profile_status_message,
  profile_avatar_key,
  profile_background_color,
  gender,
  age_group,
  'active'::public.user_status,
  NOW() - ((80 - seq) || ' days')::interval,
  NOW() - ((80 - seq) || ' days')::interval
FROM _community_seed_users;

INSERT INTO public.personality_types (
  code,
  name,
  summary,
  is_stability_oriented,
  is_challenge_oriented,
  is_analytical,
  is_collaborative,
  is_public_service_oriented
)
VALUES
  ('stability', '안정 추구형', '예측 가능한 환경에서 꾸준히 성과를 쌓는 타입이에요.', TRUE, FALSE, FALSE, FALSE, TRUE),
  ('challenge', '도전 개척형', '새로운 기회와 변화 속에서 동기가 살아나는 타입이에요.', FALSE, TRUE, FALSE, FALSE, FALSE),
  ('teamwork', '협업 조력형', '사람들과 의견을 맞추며 함께 성과를 만드는 타입이에요.', FALSE, FALSE, FALSE, TRUE, TRUE),
  ('individual', '독립 몰입형', '혼자 집중해 판단하고 완성도를 끌어올리는 타입이에요.', FALSE, FALSE, TRUE, FALSE, FALSE),
  ('execution', '실행 추진형', '고민보다 행동으로 먼저 흐름을 만드는 타입이에요.', FALSE, TRUE, FALSE, FALSE, FALSE),
  ('planning', '전략 기획형', '분석과 우선순위로 효율적인 길을 찾는 타입이에요.', FALSE, FALSE, TRUE, FALSE, TRUE),
  ('principle', '정밀 관리형', '기준과 세부 사항을 꼼꼼히 확인하는 타입이에요.', TRUE, FALSE, TRUE, FALSE, TRUE),
  ('flexibility', '유연 대응형', '상황 변화에 맞춰 현실적인 대안을 찾는 타입이에요.', FALSE, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  is_stability_oriented = EXCLUDED.is_stability_oriented,
  is_challenge_oriented = EXCLUDED.is_challenge_oriented,
  is_analytical = EXCLUDED.is_analytical,
  is_collaborative = EXCLUDED.is_collaborative,
  is_public_service_oriented = EXCLUDED.is_public_service_oriented,
  updated_at = NOW();

INSERT INTO public.diagnosis_question_sets (code, title, version, is_active)
VALUES ('community-seed-v1', '커뮤니티 시드용 진단 세트', 1, FALSE)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  version = EXCLUDED.version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

CREATE TEMP TABLE _community_seed_results ON COMMIT DROP AS
WITH question_set AS (
  SELECT id
  FROM public.diagnosis_question_sets
  WHERE code = 'community-seed-v1'
),
seed_runs AS (
  INSERT INTO public.diagnosis_runs (
    user_id,
    question_set_id,
    entry_source,
    started_at,
    completed_at,
    created_at
  )
  SELECT
    users.id,
    question_set.id,
    'community'::public.entry_source,
    NOW() - ((90 - seed_users.seq) || ' days')::interval,
    NOW() - ((90 - seed_users.seq) || ' days')::interval + '8 minutes'::interval,
    NOW() - ((90 - seed_users.seq) || ' days')::interval
  FROM _community_seed_users seed_users
  JOIN public.users users ON users.id = seed_users.id
  CROSS JOIN question_set
  RETURNING id, user_id
),
seed_results AS (
  INSERT INTO public.diagnosis_results (
    diagnosis_run_id,
    user_id,
    personality_type_id,
    total_score,
    stability_score,
    challenge_score,
    analytical_score,
    stability_axis_percent,
    teamwork_axis_percent,
    execution_axis_percent,
    principle_axis_percent,
    collaboration_score,
    leadership_score,
    public_service_score,
    is_stability_oriented,
    is_challenge_oriented,
    is_analytical,
    is_collaborative,
    is_public_service_oriented,
    summary,
    strengths,
    weaknesses,
    raw_result,
    created_at
  )
  SELECT
    seed_runs.id,
    seed_runs.user_id,
    personality_types.id,
    60 + (seed_users.seq % 36),
    CASE WHEN seed_users.diagnosis_code IN ('stability', 'principle') THEN 18 ELSE 10 + (seed_users.seq % 8) END,
    CASE WHEN seed_users.diagnosis_code IN ('challenge', 'execution', 'flexibility') THEN 18 ELSE 10 + (seed_users.seq % 8) END,
    CASE WHEN seed_users.diagnosis_code IN ('planning', 'principle', 'individual') THEN 18 ELSE 10 + (seed_users.seq % 8) END,
    CASE seed_users.diagnosis_code WHEN 'stability' THEN 72 WHEN 'challenge' THEN 35 WHEN 'principle' THEN 66 ELSE 50 + (seed_users.seq % 21) - 10 END,
    CASE seed_users.diagnosis_code WHEN 'teamwork' THEN 75 WHEN 'individual' THEN 32 ELSE 50 + (seed_users.seq % 21) - 10 END,
    CASE seed_users.diagnosis_code WHEN 'execution' THEN 74 WHEN 'planning' THEN 35 ELSE 50 + (seed_users.seq % 21) - 10 END,
    CASE seed_users.diagnosis_code WHEN 'principle' THEN 76 WHEN 'flexibility' THEN 34 ELSE 50 + (seed_users.seq % 21) - 10 END,
    CASE WHEN seed_users.diagnosis_code = 'teamwork' THEN 20 ELSE 12 + (seed_users.seq % 7) END,
    CASE WHEN seed_users.diagnosis_code IN ('challenge', 'execution') THEN 18 ELSE 11 + (seed_users.seq % 6) END,
    CASE WHEN seed_users.diagnosis_code IN ('stability', 'principle', 'planning') THEN 19 ELSE 12 + (seed_users.seq % 7) END,
    personality_types.is_stability_oriented,
    personality_types.is_challenge_oriented,
    personality_types.is_analytical,
    personality_types.is_collaborative,
    personality_types.is_public_service_oriented,
    personality_types.summary,
    jsonb_build_array(personality_types.name || ' 강점', '커뮤니티 테스트용 성향 데이터'),
    jsonb_build_array('상황별 보완점 점검'),
    jsonb_build_object('seed', true, 'typeCode', seed_users.diagnosis_code),
    NOW() - ((90 - seed_users.seq) || ' days')::interval + '8 minutes'::interval
  FROM seed_runs
  JOIN _community_seed_users seed_users ON seed_users.id = seed_runs.user_id
  JOIN public.personality_types personality_types ON personality_types.code = seed_users.diagnosis_code
  RETURNING id, user_id
)
SELECT id, user_id
FROM seed_results;

UPDATE public.users users
SET
  selected_diagnosis_result_id = seed_results.id,
  updated_at = NOW()
FROM _community_seed_results seed_results
WHERE users.id = seed_results.user_id;

CREATE TEMP TABLE _community_seed_posts (
  seq INTEGER PRIMARY KEY,
  id UUID NOT NULL,
  category VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  categories TEXT[] := ARRAY[
    '자유·잡담',
    '공시 정보',
    '공부·스터디',
    '질문·답변',
    '합격·면접 후기',
    '유머·짤'
  ];
  openers_young TEXT[] := ARRAY[
    '님들 이거 저만 헷갈림?',
    'ㄹㅇ 오늘 멘탈 나갔는데 기록 남겨봄.',
    '아니 이거 생각보다 빡세네요.',
    '혹시 비슷한 상황 겪은 분 있음?',
    '나만 이렇게 준비하는 건가 싶어서 써봄.'
  ];
  openers_plain TEXT[] := ARRAY[
    '요즘 준비하면서 느낀 점을 적어봅니다.',
    '비슷한 고민을 하시는 분들이 있을 것 같아요.',
    '오늘 공부하면서 정리한 내용을 공유합니다.',
    '지원 준비 중에 애매한 부분이 생겼습니다.',
    '혼자 판단하기 어려워서 의견을 듣고 싶습니다.'
  ];
  openers_mature TEXT[] := ARRAY[
    '최근 공고를 보며 정리한 생각입니다.',
    '준비 과정에서 반복적으로 보이는 부분이 있습니다.',
    '경험상 미리 확인하면 좋은 부분을 적어봅니다.',
    '조금 차분하게 의견을 나눠보고 싶습니다.',
    '같은 길을 준비하는 분들께 참고가 되었으면 합니다.'
  ];
  openers_senior TEXT[] := ARRAY[
    '오랜만에 준비하시는 분들께 도움이 될까 하여 적습니다.',
    '개인적인 경험이지만 참고용으로 남겨봅니다.',
    '너무 조급해하지 않으셨으면 하는 마음입니다.',
    '기본적인 이야기일 수 있지만 다시 확인해보면 좋겠습니다.',
    '서로 예의를 지키며 의견을 나누면 좋겠습니다.'
  ];
  body_bits TEXT[] := ARRAY[
    '공고문을 읽을 때 접수기간, 우대사항, 제출서류를 따로 체크해두니 실수가 줄었습니다.',
    '처음에는 양으로 밀어붙였는데, 최근에는 틀린 이유를 적는 방식이 더 효과적이었습니다.',
    '자소서는 멋있게 쓰는 것보다 내가 실제로 한 행동을 구체적으로 적는 게 낫다고 느꼈습니다.',
    '면접 준비는 예상 질문을 외우기보다 사례를 여러 각도로 설명하는 연습이 도움이 됐습니다.',
    '스터디는 사람이 중요하더라고요. 속도가 다르면 서로 피곤해져서 기준을 먼저 맞추는 게 좋았습니다.',
    '기관마다 말하는 인재상이 비슷해 보여도 실제 사업 방향을 보면 결이 조금씩 달랐습니다.',
    '하루 루틴이 무너지면 다음 날까지 끌고 가는 편이라, 최소 공부량을 낮게 잡아두고 있습니다.',
    '댓글로 다른 의견 주셔도 됩니다. 다만 근거가 있으면 서로 더 도움이 될 것 같습니다.'
  ];
  post_idx INTEGER;
  author_id UUID;
  category_value TEXT;
  category_position INTEGER;
  category_seen_counts INTEGER[] := ARRAY[0, 0, 0, 0, 0, 0];
  category_title_index INTEGER;
  title_value TEXT;
  opener_value TEXT;
  category_note TEXT;
  detail_note TEXT;
  length_tail TEXT;
  body_value TEXT;
  tone_value TEXT;
  created_value TIMESTAMPTZ;
BEGIN
  FOR post_idx IN 1..102 LOOP
    SELECT id, tone_key
    INTO author_id, tone_value
    FROM _community_seed_users
    WHERE seq = CASE WHEN post_idx = 1 THEN 1 ELSE ((post_idx * 37) % 80) + 1 END;

    category_value := CASE
      WHEN post_idx = 1 THEN '자유·잡담'
      ELSE categories[((post_idx * 17 + post_idx / 3) % array_length(categories, 1)) + 1]
    END;
    category_position := array_position(categories, category_value);
    category_seen_counts[category_position] := category_seen_counts[category_position] + 1;
    category_title_index := category_seen_counts[category_position];

    title_value := CASE
      WHEN post_idx = 1 THEN '첫 가입했습니다 다들 반가워요'
      ELSE CASE category_value
      WHEN '자유·잡담' THEN (ARRAY[
        '오늘 공부가 너무 안 돼서 잠깐 들어왔어요',
        '퇴근하고 공부하는 분들 루틴 궁금합니다',
        '멘탈 떨어질 때 다시 잡는 방법 있나요',
        '공기업 준비 시작했는데 뭐부터 해야 할까요',
        '이번 주 공부 잘 되고 계신가요',
        '혼자 준비하니까 기준 잡기가 어렵네요',
        '오늘은 책상에 앉는 것만 겨우 성공했습니다',
        '주말마다 계획이 무너지는 분들 계신가요',
        '공기업 준비한다고 말하기도 조금 부담스럽네요',
        '오래 준비하신 분들은 슬럼프 어떻게 넘기셨나요',
        '공고는 많은데 마음은 왜 더 복잡할까요',
        '아침형 공부가 정말 맞는 사람만 가능한 건가요',
        '회사 다니면서 준비하는 분들 존경합니다',
        '오늘 하루 공부 인증 대신 짧은 기록 남깁니다',
        '준비 시작하고 인간관계가 많이 줄었어요',
        '합격 후기 보다가 괜히 마음이 급해졌습니다',
        '커뮤니티 글 보면서 마음 다잡는 중입니다',
        '다들 공부 안 되는 날에도 책상에 앉으시나요',
        '이번 달 목표를 너무 크게 잡은 것 같습니다',
        '공기업 준비한다고 가족한테 설명하기 어렵네요',
        '가끔은 그냥 아무 얘기라도 하고 싶습니다',
        '오늘 계획 절반만 해도 성공으로 쳐도 될까요',
        '비슷한 처지 분들 얘기 들으면 좀 낫네요',
        '혼자 준비하는 사람의 밤 공부 기록'
      ])[category_title_index]
      WHEN '공시 정보' THEN (ARRAY[
        '한국절도공사 채용공고 바뀐 부분 정리',
        '국민업센터 접수 기간 확인하세요',
        '이번 공고 우대사항 체크한 내용 공유',
        '신입 채용 공고 마감일 헷갈리는 분들 보세요',
        '공고문 첨부파일에서 중요한 부분만 뽑아봤어요',
        '서류 제출 전에 증빙서류 목록 다시 확인하세요',
        '수정 공지 올라온 공고 몇 개 정리했습니다',
        '접수 마감 시간이 기관마다 달라서 체크 필요해요',
        '우대사항 적용 기준이 애매한 공고가 있네요',
        '채용 Q&A에 올라온 답변 중 중요한 것들',
        '경력 인정 기준 문구가 바뀐 것 같습니다',
        '오늘 마감 공고 중 놓치기 쉬운 부분',
        '블라인드 위반 가능 표현 정리해봤습니다',
        '지원서 저장 후 최종 제출 꼭 확인하세요',
        '공고문 본문이랑 첨부파일 내용이 다릅니다',
        '기관별 제출서류 차이 정리해두면 편하네요',
        '고졸 제한 공고 지원자격 확인 필요합니다',
        '지역 제한 조건 헷갈리는 분들 참고하세요',
        '인턴 경력 인정 여부 문의해본 내용입니다',
        '서류 접수 페이지 오류 대비해서 미리 제출하세요',
        '채용인원 변동 공지 나온 곳 확인했습니다',
        '공고 검색할 때 키워드 이렇게 보니까 편하네요',
        '우대자격증 표기 방식이 조금 헷갈립니다',
        '필기 일정 겹치는 공고들 미리 확인하세요'
      ])[category_title_index]
      WHEN '공부·스터디' THEN (ARRAY[
        'NCS 시간 배분 스터디 하실 분',
        '전공 공부 루틴 공유합니다',
        '오답노트 방식 바꾸고 점수 조금 올랐어요',
        '온라인 스터디 출석 체크 같이 하실 분',
        '모듈형 기본서 회독 어디까지 하셨나요',
        '이번 주 NCS 목표 같이 잡아보실 분',
        '계산 문제만 따로 푸는 루틴 효과 있네요',
        '스터디 벌금보다 인증 방식이 나은 것 같아요',
        '전공 객관식 회독 속도 어느 정도 나오세요',
        '오답을 유형별로 묶으니 반복 실수가 보입니다',
        '아침 2시간 공부 루틴 같이 하실 분',
        '독해 지문에서 시간 줄이는 방법 공유해요',
        'NCS 기본서보다 봉투모의고사가 맞는 분 있나요',
        '스터디원이랑 진도 차이 날 때 어떻게 하세요',
        '주말 몰아치기 공부가 잘 안 맞는 것 같습니다',
        '필기 전 마지막 일주일 계획 어떻게 잡으세요',
        '전공 개념서 회독표 만들어봤습니다',
        '매일 공부 인증하는 작은 방 만들어보고 싶어요',
        '모듈 암기 파트는 다들 어떻게 외우시나요',
        '오답노트 손글씨랑 앱 중 뭐가 편하세요',
        '문제 풀이보다 리뷰 시간이 더 오래 걸립니다',
        '스터디 첫 주 운영 방식 조언 구합니다',
        '시간 재고 풀면 점수가 확 떨어지네요',
        '공부 루틴 무너진 뒤 복구하는 방법'
      ])[category_title_index]
      WHEN '질문·답변' THEN (ARRAY[
        '자소서 경력사항 어디까지 쓰는 게 맞나요',
        '면접에서 모르는 질문 받으면 어떻게 답하세요',
        '인성검사 솔직하게 찍는 게 맞나요',
        '블라인드 채용에서 학교 얘기 나오면요',
        '채용인원 1명 공고도 지원하시나요',
        '자격증 하나 더 따는 게 지금 의미 있을까요',
        '서류에 아르바이트 경험 써도 괜찮을까요',
        '면접 답변이 너무 길어지는 분들 어떻게 줄이세요',
        '공백기 질문 나오면 어디까지 말해야 할까요',
        '지원동기에서 기관 사업명을 꼭 넣어야 하나요',
        '지역 제한 공고 주소 기준이 헷갈립니다',
        '인턴 경험이 직무랑 조금 달라도 써도 될까요',
        '자소서 첫 문장 너무 평범하면 감점일까요',
        '면접 복장 구두까지 꼭 맞춰야 할까요',
        '필기 컷 근처면 면접에서 뒤집기 가능할까요',
        '전공 선택과목 바꾸는 거 지금은 늦었을까요',
        'NCS 찍기 전략 실제로 도움 되나요',
        '면접에서 이전 회사 퇴사 이유 어떻게 말하세요',
        '자소서에 숫자 성과가 없으면 약해 보일까요',
        '경험 정리할 때 STAR 방식 꼭 지켜야 하나요',
        '최종 제출 후 오타 발견하면 문의해야 할까요',
        '기관 홈페이지 분석은 어디까지 해야 할까요',
        '필기 준비랑 자소서 병행이 너무 어렵습니다',
        '면접 스터디는 필수인지 궁금합니다'
      ])[category_title_index]
      WHEN '합격·면접 후기' THEN (ARRAY[
        '공기업 면접 자주 나오는 질문 정리해봤어요',
        '필기 합격 후 면접 준비 후기 남깁니다',
        '최종 탈락했지만 면접 복기 공유합니다',
        '오늘 면접 보고 온 후기입니다',
        '합격 연락 받고 가장 도움 됐던 것들',
        'PT 면접에서 당황했던 질문 복기합니다',
        '인성면접 분위기 생각보다 차분했습니다',
        '탈락 후 다시 보니 부족했던 답변들',
        '면접관 꼬리질문이 이어진 지점 정리',
        '첫 면접에서 긴장 줄이는 데 도움 된 것',
        '다대다 면접에서 느낀 점 공유합니다',
        '면접 직후 적어둔 질문 리스트 올립니다',
        '공기업 면접 답변 길이 조절 후기',
        '최종 합격까지 가장 도움 된 스터디 방식',
        '압박 질문 받았을 때 대처했던 방법',
        '탈락했지만 다음 면접엔 꼭 고칠 부분',
        '면접장 분위기와 대기 시간 후기',
        '자기소개 1분 답변 실제 반응 공유',
        '직무 경험 질문에서 꼬리질문 많이 받았습니다',
        '면접 복기하면서 발견한 제 말버릇',
        '합격 후기라기보다 준비 과정 기록입니다',
        '면접 전날 하면 좋았던 것과 별로였던 것',
        '실무진 면접과 임원 면접 느낌 차이',
        '면접 끝나고 바로 기록해야 하는 이유'
      ])[category_title_index]
      ELSE (ARRAY[
        '스터디 단톡방에서 본 웃픈 상황',
        'NCS 풀다가 계산기 찾은 사람 저뿐인가요',
        '면접 전날 잠 안 와서 만든 짤',
        '공고 마감 5분 전의 표정',
        '오늘의 공부 책상 인증 겸 잡담',
        '오답노트 펼치자마자 덮고 싶어진 순간',
        '공부 시작 전 청소가 제일 재밌는 이유',
        '봉투모의고사 뜯기 전 마음가짐',
        '스터디 인증 사진에 커피만 늘어갑니다',
        '자소서 쓰다가 갑자기 방 정리한 사람',
        '필기 전날 책상이 말해주는 현재 상태',
        'NCS 계산 문제 보고 잠깐 먼 산 봤습니다',
        '면접 준비하다가 거울이랑 싸운 후기',
        '공고 마감 알림이 심장을 때리는 순간',
        '모듈형 암기하다가 만든 이상한 암기법',
        '스터디원 모두가 동시에 조용해진 이유',
        '공부 앱 켜놓고 딴짓한 사람 모임',
        '자격증 책 샀을 때만 합격한 기분',
        '오늘의 공부 플레이리스트 실패 후기',
        '필기 합격 상상하다가 문제 틀렸습니다',
        '면접 예상질문보다 어려운 오늘 저녁 메뉴',
        '오답률 보고 웃음이 사라지는 순간',
        '마감 10분 전 제출 버튼의 무게',
        '공부 책상 위 간식 비율이 이상합니다'
      ])[category_title_index]
      END
    END;

    IF tone_value = 'young' THEN
      opener_value := openers_young[((post_idx - 1) % array_length(openers_young, 1)) + 1];
    ELSIF tone_value = 'plain' THEN
      opener_value := openers_plain[((post_idx - 1) % array_length(openers_plain, 1)) + 1];
    ELSIF tone_value = 'mature' THEN
      opener_value := openers_mature[((post_idx - 1) % array_length(openers_mature, 1)) + 1];
    ELSE
      opener_value := openers_senior[((post_idx - 1) % array_length(openers_senior, 1)) + 1];
    END IF;

    category_note := CASE category_value
      WHEN '자유·잡담' THEN '여기 분위기 어떤지 궁금해서 글 남겨봅니다. 혼자 준비하다 보니 이런저런 이야기를 나눌 곳이 필요하네요.'
      WHEN '공시 정보' THEN '공고문에서 접수기간, 우대조건, 제출서류 쪽을 중심으로 봤습니다. 원문은 꼭 한 번 더 확인하시는 게 좋겠습니다.'
      WHEN '공부·스터디' THEN '스터디는 진도보다 지속성이 더 중요한 것 같아요. 이번 주 목표와 체크 방식까지 같이 맞추면 좋겠습니다.'
      WHEN '질문·답변' THEN '검색해봐도 답이 조금씩 달라서 실제 준비하시는 분들 의견을 듣고 싶습니다. 경험담 위주면 더 도움이 될 것 같아요.'
      WHEN '합격·면접 후기' THEN '면접 분위기와 질문 흐름 위주로 적어봅니다. 기관명은 조심스럽지만 준비 방향 잡는 데 참고가 되면 좋겠습니다.'
      ELSE '너무 무겁게만 준비하면 오래 못 버티겠더라고요. 가볍게 웃고 다시 공부하자는 마음으로 올립니다.'
    END;

    detail_note := CASE category_value
      WHEN '자유·잡담' THEN (ARRAY[
        '원래 이런 글 잘 안 쓰는데 오늘은 괜히 누군가한테 말하고 싶었습니다.',
        '다들 각자 상황이 다르겠지만, 그래도 같은 목표를 보고 있다는 점에서 위로가 되네요.',
        '공부 인증을 매일 올릴 자신은 없지만 종종 와서 기록은 남겨보려고 합니다.'
      ])[((post_idx * 3) % 3) + 1]
      WHEN '공시 정보' THEN (ARRAY[
        '특히 첨부파일명이 비슷해서 이전 버전과 헷갈릴 수 있으니 다운로드 시간을 확인해보세요.',
        '지원자격 문구가 애매한 부분은 콜센터 답변만 믿기보다 채용 Q&A 공지를 같이 보는 편이 안전합니다.',
        '우대사항은 해당 여부보다 증빙서류 제출 가능 여부에서 많이 갈리는 것 같습니다.'
      ])[((post_idx * 5) % 3) + 1]
      WHEN '공부·스터디' THEN (ARRAY[
        '저는 오전에는 계산 문제, 밤에는 독해나 전공 개념처럼 머리 쓰는 방향을 나눠서 하고 있습니다.',
        '스터디는 서로 문제를 내주는 것보다 각자 틀린 이유를 설명하는 시간이 더 도움이 됐습니다.',
        '처음부터 완벽한 루틴을 만들려고 하면 금방 지쳐서, 실패해도 복구 가능한 계획이 필요했습니다.'
      ])[((post_idx * 7) % 3) + 1]
      WHEN '질문·답변' THEN (ARRAY[
        '주변에서는 괜찮다고 하는데 막상 제출하려니 작은 표현 하나도 신경 쓰입니다.',
        '예전에 비슷한 질문을 받았던 분이 있다면 실제 답변 방향을 알려주시면 좋겠습니다.',
        '정답이 하나로 정해진 문제는 아닌 것 같아서 여러 관점을 들어보고 싶습니다.'
      ])[((post_idx * 11) % 3) + 1]
      WHEN '합격·면접 후기' THEN (ARRAY[
        '면접관마다 반응이 달라서 확신은 어렵지만, 최소한 제 경험 기준으로는 준비한 사례를 구체적으로 말한 답변에 고개를 끄덕였습니다.',
        '분위기는 딱딱한 편이었지만 일부 질문은 지원자가 실제로 해본 일을 확인하려는 느낌이 강했습니다.',
        '답변을 길게 하기보다 상황, 행동, 결과를 짧게 끊어 말했을 때 흐름이 덜 무너졌습니다.'
      ])[((post_idx * 13) % 3) + 1]
      ELSE (ARRAY[
        '웃자고 올리는 글이지만 사실 이게 제일 현실적인 준비생 일상 같기도 합니다.',
        '짤 하나 만들고 다시 문제 풀러 가는 게 요즘 제 루틴입니다.',
        '가끔 이런 글 보면서 긴장 풀고 다시 책상으로 돌아가면 그걸로 충분한 것 같아요.'
      ])[((post_idx * 17) % 3) + 1]
    END;

    length_tail := CASE
      WHEN post_idx % 9 = 0 THEN E'\n\n' ||
        '조금 길게 적어보면, 예전에는 무조건 많이 하면 된다고 생각했습니다. 그런데 막상 몇 달 해보니 많이 하는 것보다 내가 어떤 부분에서 계속 틀리는지 알고 넘어가는 게 훨씬 중요하더라고요.' || E'\n' ||
        '특히 하루 컨디션이 안 좋을 때는 계획을 다 못 지킨 것보다 그다음 날 다시 돌아오는 게 더 어려웠습니다. 그래서 요즘은 최소 기준을 낮춰두고, 대신 끊기지 않게 유지하는 쪽으로 바꿨습니다.'
      WHEN post_idx % 7 = 0 THEN E'\n\n' ||
        '혹시 비슷한 경험 있는 분들은 어떻게 정리하셨는지 궁금합니다. 저는 아직 확신이 없어서 여러 의견을 보고 판단하려고 합니다.'
      WHEN post_idx % 5 = 0 THEN E'\n\n' ||
        '짧게 말하면 너무 조급해하지 말자는 쪽입니다.'
      WHEN post_idx % 4 = 0 THEN E'\n\n' ||
        '이 부분은 사람마다 생각이 다를 수 있어서 댓글로 다른 의견 남겨주셔도 괜찮습니다.'
      ELSE ''
    END;

    body_value :=
      CASE WHEN post_idx = 1 THEN
        '첫 가입했습니다! 눈팅만 하다가 오늘 처음 글 써봐요.' || E'\n\n' ||
        '공기업 준비를 시작한 지 얼마 안 돼서 아직 모르는 게 많습니다. 그래도 여기 글들 보면서 방향을 조금 잡고 있어요.' || E'\n' ||
        '앞으로 질문도 하고 후기나 공부 기록도 남겨보겠습니다. 잘 부탁드립니다.' || E'\n\n' ||
        '처음이라 글이 조금 어색할 수 있는데, 그래도 이렇게 써두면 나중에 제가 어디서 시작했는지 기억할 수 있을 것 같아서 남깁니다.'
      WHEN title_value = '합격 후기라기보다 준비 과정 기록입니다' THEN
        '합격 후기라고 쓰기에는 아직 조심스럽고, 정확히는 제가 공무원 준비를 하면서 어떤 식으로 버텼는지 남기는 과정 기록입니다.' || E'\n\n' ||
        '처음 시작할 때는 합격 수기만 계속 찾아봤습니다. 그런데 합격한 사람들의 마지막 장면만 보면 동기부여는 되지만, 실제로 하루를 어떻게 쪼개고 무너진 계획을 어떻게 복구했는지는 잘 보이지 않더라고요. 그래서 저는 제 준비 과정을 월별로 남겨두는 방식으로 정리했습니다.' || E'\n\n' ||
        '1. 시작 단계' || E'\n' ||
        '처음 한 달은 국어, 영어, 한국사, 행정법, 행정학 범위를 한 번에 잡으려다가 거의 매일 계획을 실패했습니다. 이때 제일 크게 바꾼 건 하루 목표를 과목 수가 아니라 공부 단위로 쪼갠 점입니다. 예를 들면 국어 문법 20쪽, 영어 독해 5지문, 한국사 강의 2강처럼 바로 확인 가능한 단위로 적었습니다.' || E'\n\n' ||
        '2. 기본 강의 회독' || E'\n' ||
        '기본 강의를 들을 때는 완강 자체가 목표가 되면 위험했습니다. 강의는 끝냈는데 머리에 남는 게 없어서, 강의 직후 10분이라도 빈 종이에 오늘 들은 내용을 적어봤습니다. 못 적는 부분은 다시 강의로 돌아갔고, 적을 수 있는 부분은 다음 날 문제로 확인했습니다.' || E'\n\n' ||
        '3. 기출 전환 시기' || E'\n' ||
        '기출을 시작하면서 점수가 바로 오르지는 않았습니다. 특히 행정법은 지문을 읽어도 왜 틀렸는지 잘 몰라서, 처음에는 정답률보다 선지 판단 근거를 적는 데 시간을 더 썼습니다. 맞힌 문제도 근거 없이 감으로 맞혔으면 오답으로 표시했습니다.' || E'\n\n' ||
        '4. 슬럼프 구간' || E'\n' ||
        '가장 힘들었던 건 공부량이 줄어든 날보다, 줄어든 공부량을 보고 다음 날까지 자책하는 흐름이었습니다. 그래서 저는 최소 기준을 따로 만들었습니다. 컨디션이 안 좋은 날에는 영어 단어, 한국사 기출 20문제, 행정법 판례 10개만 해도 그날은 끊기지 않은 것으로 봤습니다.' || E'\n\n' ||
        '5. 모의고사와 시간 관리' || E'\n' ||
        '모의고사는 점수 확인용이라기보다 시간 사용 습관을 보는 용도로 썼습니다. 문제를 틀린 이유를 지식 부족, 시간 부족, 실수, 지문 오독으로 나눠 적었고, 같은 유형의 실수가 세 번 이상 반복되면 다음 주 계획에 따로 넣었습니다.' || E'\n\n' ||
        '6. 면접 준비' || E'\n' ||
        '필기 이후에는 갑자기 말하기 연습을 시작하는 것보다, 준비 기간 동안 겪은 장면을 정리해두는 게 도움이 됐습니다. 민원 상황, 협업 경험, 규칙을 지켜야 했던 경험처럼 질문으로 바뀔 수 있는 소재를 짧게 정리했습니다.' || E'\n\n' ||
        '정리해보면 제 준비 과정에서 제일 중요했던 건 완벽한 계획이 아니라 복구 가능한 계획이었습니다. 계획이 무너진 날을 실패로 끝내지 않고, 다음 날 다시 돌아올 수 있게 최소 기준을 만들어두는 게 오래 버티는 데 가장 도움이 됐습니다.' || E'\n\n' ||
        '비슷하게 준비하시는 분들 의견도 궁금합니다.' || E'\n\n' ||
        '이 부분은 사람마다 생각이 다를 수 있어서 댓글로 다른 의견 남겨주셔도 괜찮습니다.'
      ELSE
        opener_value || E'\n\n' ||
        category_note || E'\n' ||
        detail_note || E'\n' ||
      body_bits[((post_idx * 2 - 1) % array_length(body_bits, 1)) + 1] || E'\n' ||
      body_bits[((post_idx * 5 - 1) % array_length(body_bits, 1)) + 1] || E'\n\n' ||
      CASE
        WHEN post_idx % 13 = 0 THEN '솔직히 반대 의견도 이해는 되는데, 준비하는 입장에서는 작은 정보 하나도 꽤 크게 느껴집니다.'
        WHEN post_idx % 11 = 0 THEN '이건 사람마다 다를 것 같아서, 너무 정답처럼 받아들이지는 않으셔도 됩니다.'
        WHEN post_idx % 7 = 0 THEN '혹시 제가 놓친 부분 있으면 편하게 알려주세요.'
        ELSE '비슷하게 준비하시는 분들 의견도 궁금합니다.'
      END ||
      length_tail
      END;

    created_value := NOW()
      - ((102 - post_idx) || ' hours')::interval
      - (((post_idx * 17) % 50) || ' minutes')::interval;

    INSERT INTO public.community_posts (
      user_id,
      category,
      title,
      content,
      view_count,
      status,
      created_at,
      updated_at
    )
    VALUES (
      author_id,
      category_value,
      title_value,
      body_value,
      3 + ((post_idx * 29) % 298),
      'active',
      created_value,
      created_value
    )
    RETURNING id INTO author_id;

    INSERT INTO _community_seed_posts (seq, id, category, title, created_at)
    VALUES (post_idx, author_id, category_value, title_value, created_value);
  END LOOP;
END $$;

DO $$
DECLARE
  post_row RECORD;
  comment_idx INTEGER;
  reply_idx INTEGER;
  comment_count INTEGER;
  reply_count INTEGER;
  comment_id UUID;
  author_id UUID;
  reply_author_id UUID;
  previous_reply_id UUID;
  reply_parent_id UUID;
  inserted_reply_id UUID;
  comment_created TIMESTAMPTZ;
  reply_created TIMESTAMPTZ;
  reply_templates_young TEXT[] := ARRAY[
    '맞아요, 저도 그쪽으로 생각이 좀 기울어요.',
    '이거 케이스마다 차이가 좀 있는 듯해요.',
    '시간 부족할 때 체감이 진짜 큽니다.',
    '저도 비슷하게 했다가 한 번 시행착오 겪었어요.',
    '포인트는 알겠는데 저는 조금 조심해서 봐야 한다고 봐요.',
    '다른 의견도 보니까 제 방식도 한 번 바꿔볼까 싶네요.',
    '그 부분 때문에 저도 지난번에 꽤 고민했어요.',
    '이렇게 해보면 적어도 방향은 빨리 잡힐 듯합니다.',
    '말도 맞는데 저는 아직 확신은 안 서네요.',
    '본문의 고민이 더 이해됩니다.'
  ];
  reply_templates_plain TEXT[] := ARRAY[
    '이야기를 보니 같은 부분이 다시 궁금해졌습니다.',
    '기준을 다시 잡아보니 이해가 됩니다.',
    '여기에 더해서 원문도 같이 확인하면 좋겠습니다.',
    '그 의견도 맞지만 예외가 꽤 있어서 조심스럽습니다.',
    '정리된 내용을 보니 흐름이 조금 잡히네요.',
    '제가 놓친 부분이 있었던 것 같습니다.',
    '이런 사례처럼 접근하면 실수를 줄일 수 있겠네요.',
    '의견에는 동의하지만 적용 범위는 한 번 더 봐야겠습니다.',
    '기준을 먼저 잡아두는 게 중요해 보입니다.',
    '실제 경험을 기준으로 정리하는 게 낫겠습니다.'
  ];
  reply_templates_mature TEXT[] := ARRAY[
    '그 부분은 조금 나눠서 봐야 할 것 같습니다.',
    '이해는 됩니다만, 실제 적용에서는 차이가 있었습니다.',
    '저도 그 부분은 다시 확인해보겠습니다.',
    '감정보다는 기준을 먼저 잡아야겠다는 생각이 듭니다.',
    '사례를 더 모아보면 판단이 쉬울 듯합니다.',
    '이 문제를 단순하게 볼 수는 없겠네요.',
    '결국 본인이 설명 가능한지가 핵심인 것 같습니다.',
    '준비 과정에서는 작은 기준 차이가 꽤 크게 느껴집니다.',
    '맞습니다. 다만 시기와 기관에 따라 달라질 수는 있겠습니다.',
    '기존 방식만 고집하면 안 되겠다는 생각이 듭니다.'
  ];
  reply_templates_senior TEXT[] := ARRAY[
    '실제 준비에서는 이런 관점도 필요하다고 봅니다.',
    '이런 경험도 충분히 의미가 있다고 생각합니다.',
    '제 경우에는 반대로 진행된 적도 있었습니다.',
    '준비생 입장에서는 작은 차이도 크게 느껴질 수 있습니다.',
    '원문과 본인의 경험을 함께 정리하는 것이 좋겠습니다.',
    '서로 다른 사례를 남겨두는 것도 의미가 있겠습니다.',
    '실제로 겪은 내용을 기준으로 말해주시면 다른 분들께도 도움이 됩니다.',
    '의견에 동의합니다. 다만 너무 서두르지 않고 확인하는 태도도 필요합니다.',
    '기본을 다시 확인하는 계기가 되었습니다.',
    '사례와 본문을 함께 보면 준비 방향을 조금 더 현실적으로 잡을 수 있겠습니다.'
  ];
  reply_short_templates TEXT[] := ARRAY[
    '감사합니다.',
    '고맙습니다~',
    '좋습니다!!',
    '저도 참고할게요.',
    '공감합니다.',
    '확인해볼게요.',
    '좋은 정보 감사합니다.',
    '오, 도움됐어요.',
    '저도 그렇게 해봐야겠네요.',
    '이건 저장해둘게요.',
    '맞는 말 같아요.',
    '짧게라도 남겨주셔서 좋아요.'
  ];
  tone_value TEXT;
  comment_text TEXT;
  reply_text TEXT;
BEGIN
  FOR post_row IN SELECT * FROM _community_seed_posts ORDER BY seq LOOP
    -- 4 out of 102 posts intentionally have no comments: about 96% post comment coverage.
    IF post_row.seq % 25 = 0 THEN
      comment_count := 0;
    ELSE
      comment_count := 1 + ((post_row.seq * 37) % 10);
    END IF;

    FOR comment_idx IN 1..comment_count LOOP
      SELECT id, tone_key
      INTO author_id, tone_value
      FROM _community_seed_users
      WHERE seq = ((post_row.seq + comment_idx * 3) % 80) + 1;

      IF post_row.seq = 1 THEN
        comment_text := (ARRAY[
          '어서 오세요. 처음 시작할 때는 모르는 게 많은 게 당연해서, 질문 남기면서 하나씩 정리하시면 금방 감이 잡히실 거예요.',
          '첫 글 남기신 거 환영합니다. 저도 처음에는 공고문 용어부터 낯설었는데, 조금씩 보다 보니 흐름이 보이기 시작했습니다.',
          '반갑습니다. 공부 기록을 남겨두면 나중에 돌아봤을 때 본인이 얼마나 쌓아왔는지 보여서 꽤 힘이 됩니다.',
          '저도 눈팅만 하다가 작은 질문부터 올리면서 도움을 많이 받았습니다. 편하게 글 남기셔도 괜찮아요.',
          '시작 단계라면 채용공고, 캘린더, 커뮤니티 질문 글을 같이 보는 것만으로도 방향 잡는 데 도움이 될 거예요.',
          '처음부터 완벽하게 준비하려고 하면 금방 지칩니다. 모르는 걸 하나씩 물어보고 정리하는 방식이 더 오래 가더라고요.',
          '환영합니다. 나중에 이 글 다시 보면 오늘이 꽤 의미 있는 출발점처럼 느껴질 수도 있을 것 같아요.',
          '공기업 준비는 혼자 하면 막막한 순간이 많아서, 이렇게 기록 남기고 사람들 얘기 듣는 것도 좋은 시작이라고 봅니다.',
          '처음 글인데도 진솔하게 적어주셔서 좋네요. 앞으로 공부 기록이나 궁금한 점 올리면 같이 얘기 나눠봐요.',
          '반가워요. 방향을 잡기 전에는 이것저것 흩어져 보이는데, 글을 남기다 보면 생각이 정리되는 순간이 오더라고요.'
        ])[comment_idx];
      ELSE
        comment_text := CASE post_row.category
          WHEN '자유·잡담' THEN
            (ARRAY[
              '오늘 글 분위기 보니까 저도 잠깐 쉬어가도 되겠다는 생각이 듭니다.',
              '혼자 준비할 때는 별일 아닌 일도 크게 느껴지는데, 이런 글 보면 조금 풀리더라고요.',
              '저는 비슷한 날에 목표를 낮추고 책상에 앉는 것만 성공으로 봤습니다.',
              '이런 기록은 당장 답이 없어도 나중에 돌아보면 은근히 힘이 됩니다.',
              '준비생끼리 그냥 오늘 어땠는지 얘기하는 공간도 필요하다고 생각합니다.',
              '속도 비교만 줄여도 마음이 훨씬 덜 흔들리는데 그게 제일 어렵더라고요.',
              '잡담처럼 보여도 결국 버티는 방식에 대한 얘기라 공감됩니다.',
              '저도 공부 안 되는 날에는 게시판 글 몇 개 보고 다시 앉는 편입니다.',
              '처음에는 다들 방향이 흐릿한 상태에서 시작하는 것 같아요.',
              '말로 꺼내두는 것만으로도 생각이 정리될 때가 있어서 이런 글 좋습니다.',
              '저는 이런 날 그냥 쉬면 죄책감이 커져서 최소 분량만 잡고 넘깁니다.',
              '공부 얘기만 계속하면 지치니까 이런 가벼운 글도 필요합니다.'
            ])[((post_row.seq + comment_idx * 5) % 12) + 1] || ' ' ||
            (ARRAY[
              '다들 비슷하게 무너졌다가 다시 붙잡는 과정이 있는 것 같아요.',
              '오늘 하루가 별로였다고 준비 전체가 틀어진 건 아니니까요.',
              '여러 의견 중에서 본인한테 맞는 방식만 골라가면 충분할 것 같습니다.',
              '가끔은 조언보다 같이 버티자는 말이 더 크게 와닿습니다.',
              '저도 이런 분위기의 글을 보면 커뮤니티가 좀 살아 있다는 느낌을 받습니다.',
              '너무 진지하게만 굴지 않아도 오래 가는 게 더 중요하다고 봐요.',
              '비슷한 처지의 사람들이 있다는 것만으로도 마음이 덜 답답합니다.',
              '기록이 쌓이면 나중에 본인 루틴을 찾는 자료가 되기도 합니다.'
            ])[((post_row.seq * 3 + comment_idx) % 8) + 1]
          WHEN '공시 정보' THEN
            (ARRAY[
              '이 공고는 마감일보다 첨부파일 세부 조건을 먼저 보는 게 안전해 보입니다.',
              '지원자격 문구가 애매하면 공고문 본문과 첨부파일을 같이 봐야 합니다.',
              '저는 이런 공고 볼 때 우대사항보다 증빙 가능 여부부터 체크합니다.',
              '마감 시간이 기관마다 달라서 캘린더에 시간까지 같이 적어두는 편입니다.',
              '공고 수정 공지가 늦게 뜨는 경우가 있어서 저장만 해두면 놓칠 수 있습니다.',
              '채용 Q&A가 열려 있으면 비슷한 질문이 이미 올라왔는지 먼저 확인합니다.',
              '경력 인정 기준은 표현이 조금만 달라도 해석이 바뀌어서 조심해야 합니다.',
              '첨부파일 이름이 비슷하면 이전 버전과 헷갈릴 수 있어 날짜를 꼭 봅니다.',
              '기관별로 같은 직무명이어도 요구하는 서류가 달라서 복붙 지원은 위험합니다.',
              '우대조건은 해당 여부보다 제출 시점에 증빙이 가능한지가 더 중요했습니다.',
              '공고 본문과 첨부파일 내용이 다르면 저는 문의 답변을 남겨두는 편입니다.',
              '지원 전에 체크리스트로 접수기간, 제출서류, 우대사항을 따로 빼두면 실수가 줄었습니다.'
            ])[((post_row.seq + comment_idx * 7) % 12) + 1] || ' ' ||
            (ARRAY[
              '이런 정보는 한 사람이 놓친 걸 다른 사람이 잡아주는 게 큰 장점 같습니다.',
              '지원 전에 원문을 한 번 더 열어보는 습관이 제일 안전했습니다.',
              '특히 마감 전날에는 수정 공지 여부를 다시 확인하는 게 좋습니다.',
              '증빙서류가 준비되지 않으면 우대사항이 있어도 실제로는 못 쓰더라고요.',
              '채용 일정은 캘린더에 넣어두고 하루 전 알림까지 걸어두는 걸 추천합니다.',
              '공고 해석은 댓글보다 최종적으로는 공식 안내 기준으로 보는 게 맞습니다.',
              '애매한 건 문의하고, 답변 받은 내용은 캡처해두면 마음이 덜 불안합니다.',
              '다른 분들도 발견한 수정 사항 있으면 이어서 공유해주시면 좋겠습니다.'
            ])[((post_row.seq * 5 + comment_idx) % 8) + 1]
          WHEN '공부·스터디' THEN
            (ARRAY[
              '스터디는 문제 수보다 피드백 방식이 맞아야 오래 가는 것 같습니다.',
              '저는 오답을 예쁘게 정리하기보다 다시 틀리지 않게 찾기 쉽게 쓰는 쪽이 맞았습니다.',
              '시간 재고 푸는 날과 개념을 다시 보는 날을 나누면 부담이 줄었습니다.',
              '진도를 크게 잡으면 한 번 밀린 뒤 복구가 어려워서 범위를 작게 잡는 게 좋았습니다.',
              '스터디 인원은 많을수록 좋은 게 아니라 빠지지 않는 사람이 더 중요했습니다.',
              '서로 문제만 던져주는 것보다 왜 틀렸는지 설명하는 시간이 더 남았습니다.',
              '벌금보다 인증 방식이 오래 간다는 말에 저도 동의합니다.',
              '저는 매일 같은 시간에 시작하는 것만 정해도 루틴 유지가 훨씬 쉬웠습니다.',
              '주말에 몰아서 하기보다 평일에 조금씩 끊기지 않게 하는 방식이 맞았습니다.',
              '모르는 문제를 바로 묻기보다 어디서 막혔는지 적어가면 답변도 잘 나오더라고요.',
              '스터디 시작 전에 목표 점수보다 운영 방식을 먼저 맞추는 게 좋았습니다.',
              '오답 공유할 때 풀이 시간까지 같이 적으면 시간 배분 감 잡는 데 도움이 됩니다.'
            ])[((post_row.seq + comment_idx * 11) % 12) + 1] || ' ' ||
            (ARRAY[
              '처음 한 주는 테스트 기간으로 보고 안 맞는 방식은 바로 바꾸는 게 현실적입니다.',
              '꾸준히 모이는 구조를 만들면 공부량은 자연스럽게 따라오는 편이었습니다.',
              '서로 속도가 다르면 스트레스가 커져서 기준을 미리 정해야 합니다.',
              '인증이 너무 빡세면 오래 못 가서 최소 기준을 낮게 잡는 게 낫습니다.',
              '오답 유형이 반복되는지 보는 게 단순 회독보다 더 중요했습니다.',
              '본인 루틴과 안 맞는 스터디는 좋은 스터디여도 오래 못 가더라고요.',
              '스터디원이 틀린 이유를 설명해줄 때 제 약점도 같이 보이는 경우가 많았습니다.',
              '목표를 작게 쪼개면 실패해도 다음 날 복구하기가 훨씬 쉽습니다.'
            ])[((post_row.seq * 7 + comment_idx) % 8) + 1]
          WHEN '질문·답변' THEN
            (ARRAY[
              '이건 지원 기관마다 기준이 달라서 공고문 문구를 먼저 보는 게 맞습니다.',
              '저라면 서류에는 면접에서 설명 가능한 경험만 남길 것 같습니다.',
              '블라인드 관련 내용은 직접 드러내기보다 직무 경험 중심으로 우회하는 게 안전해 보입니다.',
              '인성검사는 꾸며내기보다 일관성 있게 답하는 쪽이 더 중요하다고 봅니다.',
              '채용인원이 적은 공고라도 직무가 맞으면 지원해보는 편이 낫다고 생각합니다.',
              '경력사항은 많이 쓰는 것보다 해당 직무와 연결되는지가 더 중요했습니다.',
              '자격증은 하나 더 따는 것보다 지금 가진 걸 어떻게 설명할지가 먼저인 것 같습니다.',
              '면접에서 모르는 질문을 받으면 아는 범위와 모르는 범위를 나눠 말하는 게 낫더라고요.',
              '학교나 지역 얘기가 나올 수 있는 경험은 표현을 한 번 더 다듬어야 합니다.',
              '검색 결과가 다르면 최신 공고와 공식 안내를 기준으로 다시 보는 게 안전합니다.',
              '자소서 표현이 애매하면 과장으로 보이지 않게 행동과 결과를 구체화하는 게 좋습니다.',
              '질문하신 상황이면 저는 보수적으로 적고 면접에서 풀어 설명할 것 같습니다.'
            ])[((post_row.seq + comment_idx * 13) % 12) + 1] || ' ' ||
            (ARRAY[
              '정답이 하나인 문제는 아니라서 여러 사례를 같이 보는 게 좋겠습니다.',
              '최종 판단은 커뮤니티 의견보다 공식 안내와 본인 증빙 가능 여부가 우선입니다.',
              '꼬리질문이 들어와도 설명할 수 있는지 기준으로 고르면 덜 흔들립니다.',
              '답변 방향보다 왜 그렇게 판단했는지 흐름을 준비하는 게 중요해 보입니다.',
              '애매한 내용은 서류에 크게 쓰기보다 면접에서 보충하는 쪽이 안전했습니다.',
              '저도 비슷한 질문에서 욕심내다가 오히려 문장이 흐려진 적이 있습니다.',
              '불안하면 제출 전에 같은 문장을 다른 사람이 읽었을 때 어떻게 보이는지 확인해보세요.',
              '이런 질문은 경험담이 쌓일수록 판단하기 쉬워지는 것 같습니다.'
            ])[((post_row.seq * 11 + comment_idx) % 8) + 1]
          WHEN '합격·면접 후기' THEN
            (ARRAY[
              '후기에서 질문 흐름을 알려주는 부분이 특히 도움이 됩니다.',
              '압박 질문은 답 자체보다 태도와 회복력을 보는 느낌이 강했습니다.',
              '사례를 상황, 행동, 결과로 짧게 끊어 말한 부분은 저도 따라 해보려고 합니다.',
              '면접 분위기 공유가 실제 질문보다 더 크게 도움 될 때가 많았습니다.',
              '면접관 표정에 흔들리지 말라는 말은 몇 번을 들어도 부족한 것 같습니다.',
              '복기 글은 최종 결과와 상관없이 다음 준비 자료로 가치가 있습니다.',
              '같은 질문도 기관마다 의도가 달라서 후기 여러 개를 비교해보는 게 좋았습니다.',
              '면접 끝나고 바로 적어둔 복기가 나중에 가장 정확하더라고요.',
              '질문 자체보다 꼬리질문이 어디서 이어졌는지 보는 게 중요했습니다.',
              '경험을 길게 외우기보다 핵심 장면을 짧게 꺼내는 연습이 필요해 보입니다.',
              '합격 후기든 탈락 후기든 구체적인 상황이 있으면 준비 방향 잡기가 훨씬 쉽습니다.',
              '이런 글은 면접 전날 읽기보다 미리 읽고 스크립트에 반영하는 게 좋았습니다.'
            ])[((post_row.seq + comment_idx * 17) % 12) + 1] || ' ' ||
            (ARRAY[
              '공유해주신 내용은 다음 면접 준비할 때 체크리스트로 써도 될 것 같습니다.',
              '복기 남겨주셔서 감사합니다. 질문의 결을 보는 데 도움이 됩니다.',
              '저도 다음 면접 전에 답변을 짧게 정리하는 연습을 더 해야겠습니다.',
              '면접 후기를 읽을 때는 답변보다 분위기와 꼬리질문을 더 유심히 보게 됩니다.',
              '말씀하신 흐름대로라면 사례 준비의 깊이가 꽤 중요해 보입니다.',
              '탈락 후기라도 이런 정보가 남으면 다음 사람에게는 큰 자료가 됩니다.',
              '긴장했을 때도 구조를 잃지 않는 연습이 필요하다는 생각이 듭니다.',
              '기관명 없이도 준비 방향은 충분히 참고할 수 있는 글입니다.'
            ])[((post_row.seq * 13 + comment_idx) % 8) + 1]
          ELSE
            (ARRAY[
              '웃긴데 너무 현실이라 조용히 공감하고 갑니다.',
              '이런 글 하나 보고 다시 문제집 펴는 게 준비생 일상 같아요.',
              '가벼운 글인데 묘하게 동기부여가 됩니다.',
              '현실 고증이 잘돼서 웃다가 조금 아파졌습니다.',
              '이런 짤은 면접 전날 보면 안 될 것 같은데 저장은 하게 되네요.',
              '공부하다가 이런 글 보면 잠깐 숨통이 트입니다.',
              '다들 비슷하게 무너지고 다시 앉는구나 싶어서 웃겼습니다.',
              '오늘 집중력 상태랑 거의 같아서 반박을 못 하겠습니다.',
              '진지한 글 사이에 이런 글이 있어야 게시판이 살아 있는 느낌입니다.',
              '농담처럼 보여도 준비생 생활이 그대로 담겨 있어서 웃픕니다.',
              '이런 글 보고 웃고 나서 다시 책상으로 돌아가면 그걸로 충분하죠.',
              '짤 하나로 오늘의 상태를 설명할 수 있다는 게 너무 정확합니다.'
            ])[((post_row.seq + comment_idx * 19) % 12) + 1] || ' ' ||
            (ARRAY[
              '잠깐 웃었으니 이제 다시 풀러 가야겠습니다.',
              '웃긴데 제 얘기라서 마냥 웃지는 못하겠네요.',
              '가끔 이런 글이 오래 버티는 데 더 도움이 됩니다.',
              '다들 비슷한 상태인 것 같아서 위로가 됩니다.',
              '이런 가벼운 공감도 커뮤니티에는 필요하다고 봅니다.',
              '저장해두고 공부 안 될 때 한 번씩 봐야겠습니다.',
              '오늘 하루 망했다고 생각했는데 조금 덜 외로워졌습니다.',
              '웃고 넘기려 했는데 이상하게 다시 앉게 되는 글입니다.'
            ])[((post_row.seq * 17 + comment_idx) % 8) + 1]
        END;
      END IF;

      comment_created := post_row.created_at
        + (comment_idx || ' minutes')::interval
        + (((comment_idx * 13) % 40) || ' seconds')::interval;

      INSERT INTO public.community_comments (
        post_id,
        user_id,
        parent_comment_id,
        content,
        status,
        created_at,
        updated_at
      )
      VALUES (
        post_row.id,
        author_id,
        NULL,
        comment_text,
        'active',
        comment_created,
        comment_created
      )
      RETURNING id INTO comment_id;

      -- Keep most comments without replies. When a post has active discussion,
      -- spread replies across a few different top-level comments instead of
      -- stacking the whole thread under the first comment.
      reply_count := 0;

      IF post_row.seq % 4 = 0 THEN
        IF comment_idx = ((post_row.seq * 2) % comment_count) + 1 THEN
          reply_count := reply_count + 9 + (post_row.seq % 7);
        END IF;

        IF comment_count >= 3
           AND comment_idx = ((post_row.seq * 2 + 2) % comment_count) + 1 THEN
          reply_count := reply_count + 5 + (post_row.seq % 5);
        END IF;

        IF comment_count >= 6
           AND comment_idx = ((post_row.seq * 2 + 5) % comment_count) + 1 THEN
          reply_count := reply_count + 3 + (post_row.seq % 4);
        END IF;
      END IF;

      IF post_row.seq % 6 = 0 THEN
        IF comment_idx = ((post_row.seq * 3 + 1) % comment_count) + 1 THEN
          reply_count := reply_count + 6 + (post_row.seq % 6);
        END IF;

        IF comment_count >= 4
           AND comment_idx = ((post_row.seq * 3 + 4) % comment_count) + 1 THEN
          reply_count := reply_count + 2 + (post_row.seq % 4);
        END IF;
      END IF;

      IF post_row.seq % 9 = 0 THEN
        IF comment_idx = ((post_row.seq * 5) % comment_count) + 1 THEN
          reply_count := reply_count + 2 + (post_row.seq % 4);
        END IF;

        IF comment_count >= 5
           AND comment_idx = ((post_row.seq * 5 + 4) % comment_count) + 1 THEN
          reply_count := reply_count + 1 + (post_row.seq % 2);
        END IF;
      END IF;

      IF post_row.seq % 11 = 0
         AND comment_idx = ((post_row.seq * 7 + 2) % comment_count) + 1 THEN
        reply_count := reply_count + 1 + (post_row.seq % 3);
      END IF;

      IF reply_count = 0 AND (post_row.seq + comment_idx) % 17 = 0 THEN
        reply_count := 1;
      ELSIF reply_count = 0 AND (post_row.seq * comment_idx) % 31 = 0 THEN
        reply_count := 2;
      END IF;

      IF comment_count = 1 AND reply_count > 3 THEN
        reply_count := 2 + (post_row.seq % 2);
      ELSIF comment_count = 2 AND reply_count > 6 THEN
        reply_count := 4 + ((post_row.seq + comment_idx) % 3);
      ELSIF comment_count = 3 AND reply_count > 12 THEN
        reply_count := 8 + ((post_row.seq + comment_idx) % 5);
      ELSIF reply_count > 16 THEN
        reply_count := 12 + ((post_row.seq + comment_idx) % 5);
      END IF;

      previous_reply_id := NULL;

      FOR reply_idx IN 1..reply_count LOOP
        SELECT id, tone_key
        INTO reply_author_id, tone_value
        FROM _community_seed_users
        WHERE seq = ((post_row.seq * 5 + comment_idx + reply_idx * 7) % 80) + 1;

        IF previous_reply_id IS NOT NULL AND reply_idx % 5 = 0 THEN
          reply_parent_id := previous_reply_id;
        ELSE
          reply_parent_id := comment_id;
        END IF;

        IF (post_row.seq + comment_idx * 2 + reply_idx * 3) % 5 = 0 THEN
          reply_text := reply_short_templates[
            ((post_row.seq * 7 + comment_idx * 5 + reply_idx) % array_length(reply_short_templates, 1)) + 1
          ];
        ELSIF post_row.seq = 1 THEN
          reply_text := (ARRAY[
            '처음에는 질문을 자주 남기는 게 제일 빠르게 적응하는 방법 같습니다.',
            '저도 처음 시작했을 때 공고 용어부터 찾아봤던 기억이 났습니다.',
            '작은 기록부터 남기면 나중에 자기 루틴을 찾는 데 꽤 도움이 되더라고요.',
            '처음 글에는 완벽한 정보보다 계속 오겠다는 마음이 더 중요하죠.',
            '처음부터 너무 크게 잡지 말고 질문 하나씩 정리하는 게 좋겠습니다.',
            '이런 반응이면 새로 온 분도 덜 부담스러울 것 같아요.',
            '캘린더랑 공고를 같이 보는 습관만 생겨도 시작은 충분하다고 봅니다.',
            '환영해주는 댓글이 있으면 글쓴 분도 다음 글 쓰기 편할 것 같습니다.',
            '공부 기록은 짧게라도 남겨두면 나중에 복기할 때 도움이 됩니다.',
            '여기서 질문하고 답 받으면서 천천히 방향 잡아가면 될 것 같아요.',
            '저도 처음 눈팅하던 때가 생각납니다. 작은 질문이라도 올리는 게 시작이더라고요.',
            '너무 조급하게 준비하지 않아도 됩니다. 일단 꾸준히 들어오는 것부터가 시작입니다.'
          ])[((post_row.seq + reply_idx + comment_idx) % 12) + 1];
        ELSE
          IF tone_value = 'young' THEN
            reply_text := reply_templates_young[((reply_idx + comment_idx - 1) % array_length(reply_templates_young, 1)) + 1];
          ELSIF tone_value = 'plain' THEN
            reply_text := reply_templates_plain[((reply_idx + comment_idx - 1) % array_length(reply_templates_plain, 1)) + 1];
          ELSIF tone_value = 'mature' THEN
            reply_text := reply_templates_mature[((reply_idx + comment_idx - 1) % array_length(reply_templates_mature, 1)) + 1];
          ELSE
            reply_text := reply_templates_senior[((reply_idx + comment_idx - 1) % array_length(reply_templates_senior, 1)) + 1];
          END IF;

          reply_text := reply_text || ' ' || CASE post_row.category
            WHEN '자유·잡담' THEN
            (ARRAY[
              '저도 커뮤니티 보면서 덜 외롭다는 말에는 공감합니다.',
              '이런 글에는 해결책보다 같이 버티는 말이 더 도움 될 때가 있더라고요.',
              '이럴 때는 루틴보다 마음이 먼저 무너지는 날도 있는 것 같아요.',
              '그래도 첫 글에 이렇게 이야기 이어지는 게 커뮤니티 느낌 나서 좋네요.',
              '저는 이런 날에는 목표를 낮추고 책상에 앉는 것만 성공으로 칩니다.',
              '비교만 안 해도 준비 기간이 훨씬 덜 괴롭더라고요.',
              '다들 별말 아닌 것처럼 써도 사실 꽤 버티고 있는 거라 생각합니다.',
              '이런 대화가 쌓이면 나중에 새로 온 사람들도 조금 덜 막막할 것 같아요.'
            ])[((post_row.seq + reply_idx + comment_idx) % 8) + 1]
          WHEN '공시 정보' THEN
            (ARRAY[
              '그래서 첨부파일 버전하고 마감 시간을 같이 확인하는 게 안전하다고 봅니다.',
              '원문 확인은 필수고, 애매하면 채용 Q&A까지 보는 게 낫습니다.',
              '우대사항보다 증빙 가능 여부를 먼저 보는 쪽에 저도 동의합니다.',
              '이런 공고 정보는 댓글에서 서로 체크해주면 실수가 확 줄더라고요.',
              '저는 마감일보다 제출서류 누락에서 더 많이 실수할 뻔했습니다.',
              '공고 수정 공지가 뒤늦게 뜨는 경우도 있어서 북마크만 해두면 놓칠 수 있습니다.',
              '문의 답변을 받더라도 나중에 확인할 수 있게 캡처해두는 편이 좋았습니다.',
              '비슷한 공고라도 기관마다 경력 인정 기준이 달라서 복붙 판단은 위험합니다.'
            ])[((post_row.seq + reply_idx + comment_idx) % 8) + 1]
          WHEN '공부·스터디' THEN
            (ARRAY[
              '스터디 방식은 처음부터 고정하지 말고 한 주 해본 뒤 바꾸는 게 현실적입니다.',
              '오답을 어떻게 공유할지부터 정하면 훨씬 덜 흐트러집니다.',
              '시간 재고 푸는 날과 개념 보는 날을 나누자는 의견에 저도 한 표입니다.',
              '벌금보다 인증 방식이 오래 간다는 말은 제 스터디에서도 맞았습니다.',
              '저는 스터디에서 말로 설명하는 시간이 제일 효과가 컸습니다.',
              '진도를 크게 잡으면 한 번 밀린 뒤 복구가 어려워서 작게 쪼개는 게 좋았습니다.',
              '모르는 문제를 바로 묻기보다 어디서 막혔는지 적어가면 답변도 잘 나오더라고요.',
              '출석만 강요하는 스터디보다 서로 공부 방식까지 맞춰보는 쪽이 더 오래 갔습니다.'
            ])[((post_row.seq + reply_idx + comment_idx) % 8) + 1]
          WHEN '질문·답변' THEN
            (ARRAY[
              '질문하신 상황이면 저도 보수적으로 적고 면접에서 풀어 설명할 것 같습니다.',
              '기관마다 기준이 달라서 공고 문구를 먼저 잡는 게 맞아 보입니다.',
              '정답이 하나인 질문은 아니라서 여러 사례를 모아보는 게 좋겠습니다.',
              '면접 답변이라면 결론보다 왜 그렇게 판단했는지 흐름이 더 중요해 보입니다.',
              '저라면 애매한 경험은 과감히 빼고 확실한 사례를 더 깊게 준비하겠습니다.',
              '블라인드 관련 내용은 직접 표현보다 직무 경험 중심으로 돌리는 게 안전해 보입니다.',
              '지원자격 질문은 커뮤니티 답변보다 기관 문의를 기준으로 삼는 게 맞다고 봅니다.',
              '면접에서 설명할 수 없는 내용이면 서류에도 너무 크게 쓰지 않는 편이 낫겠습니다.'
            ])[((post_row.seq + reply_idx + comment_idx) % 8) + 1]
          WHEN '합격·면접 후기' THEN
            (ARRAY[
              '이런 복기는 다음 면접 준비할 때 질문 흐름 잡는 데 진짜 도움 됩니다.',
              '압박 질문은 답 자체보다 태도를 보는 느낌이 강했습니다.',
              '사례를 짧게 끊어 말했다는 부분은 저도 다음 면접 때 써보려고 합니다.',
              '후기 글에서는 이런 세부 분위기 공유가 제일 값진 것 같아요.',
              '저도 면접 끝나고 바로 복기했을 때 다음 준비가 훨씬 수월했습니다.',
              '질문 자체보다 꼬리질문이 어디서 나왔는지 보는 게 더 중요하더라고요.',
              '면접관 표정에 흔들리지 말라는 말은 진짜 몇 번을 들어도 부족합니다.',
              '합격 후기든 탈락 후기든 구체적인 상황이 있으면 준비 방향 잡기가 좋습니다.'
            ])[((post_row.seq + reply_idx + comment_idx) % 8) + 1]
          ELSE
            (ARRAY[
              '웃기긴 한데 다들 겪는 상황이라 더 공감됩니다.',
              '잠깐 웃고 다시 책상으로 가면 그걸로 충분하죠.',
              '이런 가벼운 글이 중간중간 있어야 오래 버티는 것 같습니다.',
              '농담처럼 보여도 준비생 생활이 그대로 담겨 있어서 웃프네요.',
              '저도 이런 글 보고 잠깐 웃다가 결국 다시 문제집 폅니다.',
              '웃긴데 현실이라 저장해두면 나중에 또 보게 될 것 같습니다.',
              '진지한 글 사이에 이런 글이 있어야 게시판이 좀 살아 있는 느낌입니다.',
              '오늘 집중력 망한 사람들끼리 조용히 공감하고 지나가는 글 같네요.'
            ])[((post_row.seq + reply_idx + comment_idx) % 8) + 1]
          END;

          reply_text := reply_text || CASE
            WHEN reply_idx % 23 = 0 THEN E'\n' ||
              '저는 이 부분에서 의견이 조금 다릅니다. 준비생 입장에서는 작은 차이도 크게 느껴질 수 있고, 실제로 그 차이 때문에 지원 여부를 바꾸는 경우도 있거든요.'
            WHEN reply_idx % 12 = 0 THEN ' 다만 이런 방식이 모두에게 맞는 건 아니라서 본인 상황에 맞게 조정해야 할 것 같습니다.'
            WHEN reply_idx % 7 = 0 THEN ' 저는 비슷하게 했다가 중간에 한 번 바꿨는데, 바꾸고 나서 오히려 정리가 잘 됐습니다.'
            WHEN reply_idx % 5 = 0 THEN ' 그래서 저는 여러 의견을 합쳐서 보는 쪽이 더 현실적이라고 생각합니다.'
            ELSE ''
          END;
        END IF;

        reply_created := comment_created
          + ((reply_idx * (2 + ((post_row.seq + comment_idx) % 4))) || ' minutes')::interval
          + ((((reply_idx * 7) + (comment_idx * 11)) % 45) || ' seconds')::interval;

        INSERT INTO public.community_comments (
          post_id,
          user_id,
          parent_comment_id,
          content,
          status,
          created_at,
          updated_at
        )
        VALUES (
          post_row.id,
          reply_author_id,
          reply_parent_id,
          reply_text,
          'active',
          reply_created,
          reply_created
        )
        RETURNING id INTO inserted_reply_id;

        previous_reply_id := inserted_reply_id;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Seed recent popular searches so the popular keyword UI has realistic data.
CREATE TEMP TABLE _community_seed_search_terms (
  rank_no INTEGER PRIMARY KEY,
  query VARCHAR(80) NOT NULL,
  search_count INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO _community_seed_search_terms (rank_no, query, search_count)
VALUES
  (1, '공무원 시험', 45),
  (2, '9급 공무원', 42),
  (3, '행정법 기출', 39),
  (4, '지방직 공무원', 29),
  (5, '국가직 공무원', 20),
  (6, '공무원 면접', 14),
  (7, '한국사 기출', 11),
  (8, '공무원 공부법', 9),
  (9, '공무원 영어', 7),
  (10, '공무원 합격수기', 5);

INSERT INTO public.community_search_logs (user_id, query, created_at)
SELECT
  users.id,
  terms.query,
  NOW() - ((terms.rank_no * 11 + search_numbers.search_no) || ' minutes')::interval
FROM _community_seed_search_terms terms
CROSS JOIN LATERAL generate_series(1, terms.search_count) AS search_numbers(search_no)
JOIN _community_seed_users users
  ON users.seq = ((terms.rank_no * 9 + search_numbers.search_no * 7) % 80) + 1;

INSERT INTO public.community_search_terms (query, search_count, last_searched_at, updated_at)
SELECT
  logs.query,
  COUNT(DISTINCT logs.user_id)::integer,
  MAX(logs.created_at),
  MAX(logs.created_at)
FROM public.community_search_logs logs
WHERE logs.query IN (SELECT query FROM _community_seed_search_terms)
  AND logs.user_id IS NOT NULL
GROUP BY logs.query
ON CONFLICT (query) DO UPDATE SET
  search_count = EXCLUDED.search_count,
  last_searched_at = EXCLUDED.last_searched_at,
  updated_at = EXCLUDED.updated_at;

-- Add a light spread of post/comment reactions for list/detail count testing.
INSERT INTO public.community_post_reactions (post_id, user_id, reaction_type, created_at)
SELECT
  posts.id,
  users.id,
  'recommend',
  posts.created_at + ((reaction_numbers.reaction_no * 7) || ' minutes')::interval
FROM _community_seed_posts posts
CROSS JOIN LATERAL generate_series(1, ((posts.seq * 7) % 16)) AS reaction_numbers(reaction_no)
JOIN _community_seed_users users
  ON users.seq = ((posts.seq * 11 + reaction_numbers.reaction_no * 3) % 80) + 1
ON CONFLICT DO NOTHING;

INSERT INTO public.community_post_reactions (post_id, user_id, reaction_type, created_at)
SELECT posts.id, users.id, 'scrap', posts.created_at + '3 hours'::interval
FROM _community_seed_posts posts
JOIN _community_seed_users users ON users.seq = ((posts.seq * 13) % 80) + 1
WHERE posts.seq % 5 = 0
ON CONFLICT DO NOTHING;

INSERT INTO public.community_comment_reactions (comment_id, user_id, reaction_type, created_at, updated_at)
WITH ranked_comments AS (
  SELECT
    comments.id,
    comments.created_at,
    ROW_NUMBER() OVER (ORDER BY comments.created_at, comments.id) AS rn
  FROM public.community_comments comments
  WHERE comments.status = 'active'
)
SELECT
  ranked_comments.id,
  users.id,
  'like',
  ranked_comments.created_at + ((reaction_numbers.reaction_no * 5) || ' minutes')::interval,
  ranked_comments.created_at + ((reaction_numbers.reaction_no * 5) || ' minutes')::interval
FROM ranked_comments
CROSS JOIN LATERAL generate_series(1, ((ranked_comments.rn * 5) % 7)::integer) AS reaction_numbers(reaction_no)
JOIN _community_seed_users users
  ON users.seq = ((ranked_comments.rn * 11 + reaction_numbers.reaction_no * 7) % 80) + 1
ON CONFLICT DO NOTHING;

INSERT INTO public.community_comment_reactions (comment_id, user_id, reaction_type, created_at, updated_at)
WITH ranked_comments AS (
  SELECT
    comments.id,
    comments.created_at,
    ROW_NUMBER() OVER (ORDER BY comments.created_at, comments.id) AS rn
  FROM public.community_comments comments
  WHERE comments.status = 'active'
)
SELECT
  ranked_comments.id,
  users.id,
  'dislike',
  ranked_comments.created_at + ((reaction_numbers.reaction_no * 9) || ' minutes')::interval,
  ranked_comments.created_at + ((reaction_numbers.reaction_no * 9) || ' minutes')::interval
FROM ranked_comments
CROSS JOIN LATERAL generate_series(1, CASE WHEN ranked_comments.rn % 5 = 0 THEN ((ranked_comments.rn * 3) % 3)::integer + 1 ELSE 0 END) AS reaction_numbers(reaction_no)
JOIN _community_seed_users users
  ON users.seq = ((ranked_comments.rn * 13 + reaction_numbers.reaction_no * 11) % 80) + 1
ON CONFLICT DO NOTHING;

ANALYZE public.community_posts;
ANALYZE public.community_comments;
ANALYZE public.community_post_reactions;
ANALYZE public.community_comment_reactions;

COMMIT;

-- Quick check after execution:
-- SELECT COUNT(*) AS post_count FROM public.community_posts;
-- SELECT COUNT(*) FILTER (WHERE parent_comment_id IS NULL) AS comment_count,
--        COUNT(*) FILTER (WHERE parent_comment_id IS NOT NULL) AS reply_count
-- FROM public.community_comments;
