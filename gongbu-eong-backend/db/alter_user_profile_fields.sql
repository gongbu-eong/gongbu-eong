ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS community_nickname VARCHAR(12),
  ADD COLUMN IF NOT EXISTS profile_status_message VARCHAR(30),
  ADD COLUMN IF NOT EXISTS profile_avatar_key VARCHAR(30) NOT NULL DEFAULT (
    (ARRAY[
      'fox',
      'lion',
      'cat',
      'penguin',
      'chick',
      'monkey',
      'cow',
      'bear',
      'chicken',
      'mouse'
    ])[FLOOR(RANDOM() * 10 + 1)::integer]
  ),
  ADD COLUMN IF NOT EXISTS profile_background_color VARCHAR(20) NOT NULL DEFAULT '#c4c6ca',
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS age_group VARCHAR(20);

UPDATE public.users
SET
  profile_avatar_key = COALESCE(
    profile_avatar_key,
    (ARRAY[
      'fox',
      'lion',
      'cat',
      'penguin',
      'chick',
      'monkey',
      'cow',
      'bear',
      'chicken',
      'mouse'
    ])[FLOOR(RANDOM() * 10 + 1)::integer]
  ),
  profile_background_color = COALESCE(profile_background_color, '#c4c6ca')
WHERE profile_avatar_key IS NULL
   OR profile_background_color IS NULL;

ALTER TABLE public.users
  ALTER COLUMN profile_avatar_key SET DEFAULT (
    (ARRAY[
      'fox',
      'lion',
      'cat',
      'penguin',
      'chick',
      'monkey',
      'cow',
      'bear',
      'chicken',
      'mouse'
    ])[FLOOR(RANDOM() * 10 + 1)::integer]
  ),
  ALTER COLUMN profile_avatar_key SET NOT NULL,
  ALTER COLUMN profile_background_color SET DEFAULT '#c4c6ca',
  ALTER COLUMN profile_background_color SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_profile_avatar_key_check
    CHECK (profile_avatar_key IN (
      'fox',
      'lion',
      'cat',
      'penguin',
      'chick',
      'monkey',
      'cow',
      'bear',
      'chicken',
      'mouse'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_profile_background_color_check
    CHECK (profile_background_color IN (
      '#c6d5ff',
      '#b9c9ff',
      '#d1c2ff',
      '#f5bfd9',
      '#c7ecdc',
      '#f5d2b0',
      '#c9d6d8',
      '#c4c6ca'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_gender_check
    CHECK (gender IS NULL OR gender IN ('female', 'male'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_age_group_check
    CHECK (age_group IS NULL OR age_group IN (
      'teens',
      'early_20s',
      'late_20s',
      'early_30s',
      'late_30s',
      'over_40'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
