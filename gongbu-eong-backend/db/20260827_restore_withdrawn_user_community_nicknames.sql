-- Restore withdrawn users' public community nicknames from withdrawal snapshots.
--
-- This is needed only for environments where the previous withdrawal logic
-- already replaced nickname/display_name/community_nickname with '탈퇴한 사용자'.
-- Public community posts/comments remain after withdrawal, so the author's
-- community nickname should remain visible as originally displayed.

BEGIN;

WITH latest_retained_profile AS (
  SELECT DISTINCT ON (profiles.user_id)
    profiles.user_id,
    profiles.nickname,
    profiles.display_name,
    profiles.community_nickname
  FROM public.user_withdrawal_retained_profiles profiles
  WHERE profiles.user_id IS NOT NULL
  ORDER BY profiles.user_id, profiles.created_at DESC
)
UPDATE public.users users
SET
  nickname = COALESCE(latest_retained_profile.nickname, users.nickname),
  display_name = COALESCE(latest_retained_profile.display_name, users.display_name),
  community_nickname = COALESCE(latest_retained_profile.community_nickname, users.community_nickname),
  updated_at = NOW()
FROM latest_retained_profile
WHERE users.id = latest_retained_profile.user_id
  AND users.status = 'withdrawn'
  AND (
    users.nickname = '탈퇴한 사용자'
    OR users.display_name = '탈퇴한 사용자'
    OR users.community_nickname = '탈퇴한 사용자'
  );

COMMIT;
