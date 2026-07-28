-- 강점·성향 진단 문항 노출 순서를 섞는다.
-- 문항 내용, trait_key, 선택지 점수는 유지하고 question_no만 재배치한다.
-- 각 4문항 구간에 안정/협업/실행/원칙 축이 하나씩 포함되도록 구성했다.

UPDATE public.diagnosis_question_sets
SET version = 4,
    updated_at = NOW()
WHERE code = 'civil-service-basic-v1';

WITH question_set AS (
  SELECT id
  FROM public.diagnosis_question_sets
  WHERE code = 'civil-service-basic-v1'
),
questions AS (
  SELECT *
  FROM (
    VALUES
      (1, '정해진 절차와 기준이 있을 때 더 편하게 집중할 수 있다.', 'stability_axis', FALSE),
      (2, '사람들과 의견을 나누며 방향을 정할 때 더 좋은 결과가 나온다고 느낀다.', 'teamwork_axis', FALSE),
      (3, '계획이 완벽하지 않아도 우선 시작하면서 방향을 잡는 편이다.', 'execution_axis', FALSE),
      (4, '정해진 규칙과 원칙은 가능한 한 정확히 지켜야 한다고 생각한다.', 'principle_axis', FALSE),
      (5, '해야 할 일이 생기면 오래 고민하기보다 먼저 움직이는 편이다.', 'execution_axis', FALSE),
      (6, '작은 실수나 빠진 조건도 그냥 넘기지 않고 다시 확인하는 편이다.', 'principle_axis', FALSE),
      (7, '결과가 어느 정도 예측되는 공부 방식이나 업무 방식이 나에게 잘 맞는다.', 'stability_axis', FALSE),
      (8, '혼자 결정하기보다 주변의 피드백을 듣고 조정하는 과정이 편하다.', 'teamwork_axis', FALSE),
      (9, '일을 마무리하기 전 세부 조건이 맞는지 꼼꼼히 점검한다.', 'principle_axis', FALSE),
      (10, '생각만 오래 하기보다 작은 행동으로 확인하는 방식이 나에게 맞다.', 'execution_axis', FALSE),
      (11, '역할을 나누고 서로 보완하는 방식이 나에게 잘 맞는다.', 'teamwork_axis', FALSE),
      (12, '새로운 방식을 시도하기 전, 먼저 검증된 방법이 있는지 확인하는 편이다.', 'stability_axis', FALSE),
      (13, '중요한 일을 할 때도 함께 논의할 사람이 있으면 더 안정감을 느낀다.', 'teamwork_axis', FALSE),
      (14, '변수가 많은 상황보다 안정적으로 준비할 수 있는 환경이 더 좋다.', 'stability_axis', FALSE),
      (15, '기준이 명확할수록 더 안정적으로 일할 수 있다.', 'principle_axis', FALSE),
      (16, '실행하면서 부족한 부분을 수정해 나가는 편이 더 효율적이라고 느낀다.', 'execution_axis', FALSE)
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
