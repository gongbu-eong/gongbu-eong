ALTER TABLE public.diagnosis_results
  ADD COLUMN IF NOT EXISTS stability_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS teamwork_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS execution_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS principle_axis_percent INTEGER NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.diagnosis_results.stability_axis_percent
  IS '안정지향 ↔ 도전 축의 왼쪽 성향(안정지향) 퍼센트. 도전 점수는 100 - stability_axis_percent로 계산한다.';
COMMENT ON COLUMN public.diagnosis_results.teamwork_axis_percent
  IS '팀 협업 ↔ 개인 축의 왼쪽 성향(팀 협업) 퍼센트. 개인 점수는 100 - teamwork_axis_percent로 계산한다.';
COMMENT ON COLUMN public.diagnosis_results.execution_axis_percent
  IS '실행력 ↔ 기획 축의 왼쪽 성향(실행력) 퍼센트. 기획 점수는 100 - execution_axis_percent로 계산한다.';
COMMENT ON COLUMN public.diagnosis_results.principle_axis_percent
  IS '원칙·꼼꼼함 ↔ 유연 축의 왼쪽 성향(원칙·꼼꼼함) 퍼센트. 유연 점수는 100 - principle_axis_percent로 계산한다.';

COMMENT ON COLUMN public.diagnosis_results.raw_result
  IS '8성향 점수(traitScores), 4축 결과(axisResults), 내부 직무성향 보조 점수(vocationalFitScores), 개인 내 비교 방식(scoring)을 저장한다.';

-- 8가지 대표 성향과 16문항 seed는 db/seed_diagnosis.sql을 이어서 실행한다.
