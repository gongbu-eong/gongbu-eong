-- AI NCS 자소서 코칭 결과에서 등급 표시를 제거한 뒤,
-- 과거 feedback JSON에 남아 있는 grade 필드만 정리하는 선택 실행 스크립트입니다.
-- resume_coaching_results에는 별도 grade 컬럼이 없으므로 DROP COLUMN은 필요하지 않습니다.

UPDATE public.resume_coaching_results
SET feedback = feedback - 'grade'
WHERE feedback ? 'grade';
