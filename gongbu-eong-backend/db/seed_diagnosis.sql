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
  (
    'stability',
    '안정 추구형',
    '예측 가능한 환경에서 꾸준히 성과를 쌓는 타입이에요.',
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    TRUE
  ),
  (
    'challenge',
    '도전 개척형',
    '새로운 기회와 변화 속에서 동기가 살아나는 타입이에요.',
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  ),
  (
    'teamwork',
    '협업 조력형',
    '사람들과 의견을 맞추며 함께 성과를 만드는 타입이에요.',
    FALSE,
    FALSE,
    FALSE,
    TRUE,
    TRUE
  ),
  (
    'individual',
    '독립 몰입형',
    '혼자 집중해 판단하고 완성도를 끌어올리는 타입이에요.',
    FALSE,
    FALSE,
    TRUE,
    FALSE,
    FALSE
  ),
  (
    'execution',
    '실행 추진형',
    '고민보다 행동으로 먼저 흐름을 만드는 타입이에요.',
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  ),
  (
    'planning',
    '전략 기획형',
    '분석과 우선순위로 효율적인 길을 찾는 타입이에요.',
    FALSE,
    FALSE,
    TRUE,
    FALSE,
    TRUE
  ),
  (
    'principle',
    '정밀 관리형',
    '기준과 세부 사항을 꼼꼼히 확인하는 타입이에요.',
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    TRUE
  ),
  (
    'flexibility',
    '유연 대응형',
    '상황 변화에 맞춰 현실적인 대안을 찾는 타입이에요.',
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE
  )
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
VALUES ('civil-service-basic-v1', '강점·성향 진단(기본)', 2, TRUE)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  version = EXCLUDED.version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH question_set AS (
  SELECT id FROM public.diagnosis_question_sets WHERE code = 'civil-service-basic-v1'
),
questions AS (
  SELECT *
  FROM (
    VALUES
      (1, '정해진 절차와 기준이 있는 환경에서 더 편하게 일한다.', 'stability_axis', FALSE),
      (2, '익숙하지 않은 방식이라도 더 나은 결과가 기대되면 시도해보고 싶다.', 'stability_axis', TRUE),
      (3, '결과가 예측 가능한 업무나 공부 방식이 나에게 잘 맞는다.', 'stability_axis', FALSE),
      (4, '실패 가능성이 있어도 성장할 수 있는 기회라면 도전하는 편이다.', 'stability_axis', TRUE),
      (5, '사람들과 의견을 나누며 함께 방향을 정하는 과정이 잘 맞는다.', 'teamwork_axis', FALSE),
      (6, '중요한 일은 다른 사람과 맞추기보다 혼자 집중해서 처리하는 편이다.', 'teamwork_axis', TRUE),
      (7, '팀 안에서 역할을 나누고 서로 보완할 때 더 좋은 결과가 난다고 느낀다.', 'teamwork_axis', FALSE),
      (8, '여러 사람의 의견을 조율하는 과정은 에너지가 많이 든다.', 'teamwork_axis', TRUE),
      (9, '계획이 완벽하지 않아도 우선 시작하면서 방향을 잡는 편이다.', 'execution_axis', FALSE),
      (10, '시작하기 전에 목표, 순서, 기준을 충분히 정리해야 마음이 놓인다.', 'execution_axis', TRUE),
      (11, '해야 할 일이 생기면 오래 고민하기보다 바로 행동으로 옮기는 편이다.', 'execution_axis', FALSE),
      (12, '일을 시작하기 전 자료를 비교하고 가능성을 분석하는 시간이 중요하다.', 'execution_axis', TRUE),
      (13, '정해진 규칙과 원칙은 가능한 한 정확히 지켜야 한다고 생각한다.', 'principle_axis', FALSE),
      (14, '상황이 달라지면 기존 기준도 현실에 맞게 조정할 수 있어야 한다.', 'principle_axis', TRUE),
      (15, '작은 실수나 빠진 조건도 그냥 넘기지 않고 다시 확인하는 편이다.', 'principle_axis', FALSE),
      (16, '계획대로 되지 않아도 그때그때 대안을 찾으며 움직이는 편이다.', 'principle_axis', TRUE)
  ) AS q(question_no, question_text, trait_key, reverse_scored)
)
INSERT INTO public.diagnosis_questions (
  question_set_id,
  question_no,
  question_text,
  trait_key,
  reverse_scored,
  is_active
)
SELECT
  question_set.id,
  questions.question_no,
  questions.question_text,
  questions.trait_key,
  questions.reverse_scored,
  TRUE
FROM question_set
CROSS JOIN questions
ON CONFLICT (question_set_id, question_no) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  trait_key = EXCLUDED.trait_key,
  reverse_scored = EXCLUDED.reverse_scored,
  is_active = TRUE,
  updated_at = NOW();

UPDATE public.diagnosis_questions
SET is_active = FALSE,
    updated_at = NOW()
WHERE question_set_id = (
    SELECT id FROM public.diagnosis_question_sets WHERE code = 'civil-service-basic-v1'
  )
  AND question_no > 16;

WITH options AS (
  SELECT *
  FROM (
    VALUES
      (1, '전혀 아니다.', 1),
      (2, '아닌 편이다.', 2),
      (3, '보통이다.', 3),
      (4, '그런 편이다.', 4),
      (5, '매우 그렇다.', 5)
  ) AS o(option_no, option_text, score)
)
INSERT INTO public.diagnosis_question_options (
  question_id,
  option_no,
  option_text,
  score
)
SELECT
  diagnosis_questions.id,
  options.option_no,
  options.option_text,
  options.score
FROM public.diagnosis_questions
CROSS JOIN options
JOIN public.diagnosis_question_sets
  ON diagnosis_question_sets.id = diagnosis_questions.question_set_id
WHERE diagnosis_question_sets.code = 'civil-service-basic-v1'
  AND diagnosis_questions.is_active = TRUE
ON CONFLICT (question_id, option_no) DO UPDATE SET
  option_text = EXCLUDED.option_text,
  score = EXCLUDED.score;
