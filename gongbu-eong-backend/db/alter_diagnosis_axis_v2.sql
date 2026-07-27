ALTER TABLE public.diagnosis_results
  ADD COLUMN IF NOT EXISTS stability_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS teamwork_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS execution_axis_percent INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS principle_axis_percent INTEGER NOT NULL DEFAULT 50;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'diagnosis_results'
      AND column_name = 'challenge_axis_percent'
  ) THEN
    EXECUTE '
      UPDATE public.diagnosis_results
      SET
        stability_axis_percent = COALESCE(challenge_axis_percent, stability_axis_percent),
        teamwork_axis_percent = COALESCE(individual_axis_percent, teamwork_axis_percent),
        execution_axis_percent = COALESCE(planning_axis_percent, execution_axis_percent),
        principle_axis_percent = COALESCE(flexibility_axis_percent, principle_axis_percent)
    ';
  END IF;
END $$;

COMMENT ON COLUMN public.diagnosis_results.stability_axis_percent
  IS '안정지향 ↔ 도전 축에서 왼쪽 성향(안정지향)에 가까운 정도(0~100)';
COMMENT ON COLUMN public.diagnosis_results.teamwork_axis_percent
  IS '팀 협업 ↔ 개인 축에서 왼쪽 성향(팀 협업)에 가까운 정도(0~100)';
COMMENT ON COLUMN public.diagnosis_results.execution_axis_percent
  IS '실행력 ↔ 기획 축에서 왼쪽 성향(실행력)에 가까운 정도(0~100)';
COMMENT ON COLUMN public.diagnosis_results.principle_axis_percent
  IS '원칙·꼼꼼함 ↔ 유연 축에서 왼쪽 성향(원칙·꼼꼼함)에 가까운 정도(0~100)';
