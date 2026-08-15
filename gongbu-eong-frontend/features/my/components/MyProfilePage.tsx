"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getCurrentUser, getHomeJobs } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getMyProfile, updateMyProfile } from "../my.api";
import type {
  ProfileAgeGroup,
  ProfileAvatarKey,
  ProfileGender,
  UserProfileDto,
} from "../my.dto";
import styles from "./MyProfile.module.css";

const AVATARS: Array<{ key: ProfileAvatarKey; src: string; label: string }> = [
  { key: "fox", src: "/my/avatars/fox-profile.png?v=3", label: "여우" },
  { key: "lion", src: "/my/avatars/lion-profile.png?v=3", label: "사자" },
  { key: "cat", src: "/my/avatars/cat-profile.png?v=3", label: "고양이" },
  { key: "penguin", src: "/my/avatars/penguin-profile.png?v=3", label: "펭귄" },
  { key: "chick", src: "/my/avatars/chick-profile.png?v=3", label: "병아리" },
  { key: "monkey", src: "/my/avatars/monkey-profile.png?v=3", label: "원숭이" },
  { key: "cow", src: "/my/avatars/cow-profile.png?v=3", label: "소" },
  { key: "bear", src: "/my/avatars/bear-profile.png?v=3", label: "곰" },
  { key: "chicken", src: "/my/avatars/chicken-profile.png?v=3", label: "닭" },
  { key: "mouse", src: "/my/avatars/mouse-profile.png?v=3", label: "쥐" },
];

const BACKGROUND_COLORS = [
  "#c6d5ff",
  "#b9c9ff",
  "#d1c2ff",
  "#f5bfd9",
  "#c7ecdc",
  "#f5d2b0",
  "#c9d6d8",
  "#c4c6ca",
];

const GENDERS: Array<{ value: ProfileGender; label: string }> = [
  { value: "female", label: "여성" },
  { value: "male", label: "남성" },
];

const AGE_GROUPS: Array<{ value: ProfileAgeGroup; label: string }> = [
  { value: "teens", label: "10대" },
  { value: "early_20s", label: "20대 초반" },
  { value: "late_20s", label: "20대 후반" },
  { value: "early_30s", label: "30대 초반" },
  { value: "late_30s", label: "30대 후반" },
  { value: "over_40", label: "40대 이상" },
];

export function MyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [avatarKey, setAvatarKey] = useState<ProfileAvatarKey>("fox");
  const [backgroundColor, setBackgroundColor] = useState("#c4c6ca");
  const [communityNickname, setCommunityNickname] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [gender, setGender] = useState<ProfileGender | null>(null);
  const [ageGroup, setAgeGroup] = useState<ProfileAgeGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      getCurrentUser().catch(() => null),
      getHomeJobs().catch(() => null),
      getMyProfile(),
    ])
      .then(([userResponse, jobsResponse, profileResponse]) => {
        if (!active) return;
        const nextProfile = profileResponse.profile;
        setUser(userResponse?.authenticated ? userResponse.user : null);
        setBookmarkCount(jobsResponse?.bookmarkCount ?? 0);
        setProfile(nextProfile);
        setAvatarKey(nextProfile.profileAvatarKey);
        setBackgroundColor(nextProfile.profileBackgroundColor);
        setCommunityNickname(nextProfile.communityNickname || "");
        setStatusMessage(nextProfile.profileStatusMessage || "");
        setGender(nextProfile.gender);
        setAgeGroup(nextProfile.ageGroup);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "프로필을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedAvatar = useMemo(
    () => AVATARS.find((avatar) => avatar.key === avatarKey) || AVATARS[0],
    [avatarKey],
  );
  const displayName = communityNickname.trim() || profile?.communityNickname || ".";

  const saveProfile = async () => {
    if (saving) return;
    const nickname = communityNickname.trim();
    const trimmedStatus = statusMessage.trim();

    if (!nickname) {
      setMessage("닉네임을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await updateMyProfile({
        communityNickname: nickname,
        profileStatusMessage: trimmedStatus || null,
        profileAvatarKey: avatarKey,
        profileBackgroundColor: backgroundColor,
        gender,
        ageGroup,
      });
      setProfile(response.profile);
      setMessage("프로필이 저장되었습니다.");
      router.replace("/my");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader user={user} nickname={displayName} bookmarkCount={bookmarkCount} />
      <main className={styles.frame}>
        <h1>마이페이지</h1>

        <section className={styles.profileSummary} aria-label="프로필 미리보기">
          <span
            className={styles.summaryAvatar}
            style={{ backgroundColor }}
            aria-hidden="true"
          >
            <Image src={selectedAvatar.src} alt="" width={64} height={64} unoptimized />
          </span>
          <div>
            <strong>{displayName}</strong>
            <p>{statusMessage || "커뮤니티에서 사용하는 상태 메시지를 입력하세요."}</p>
          </div>
        </section>

        {loading ? (
          <p className={styles.message}>프로필을 불러오고 있습니다.</p>
        ) : (
          <>
            <section className={styles.fieldSection}>
              <h2>아바타</h2>
              <div className={styles.avatarGrid}>
                {AVATARS.map((avatar) => (
                  <button
                    type="button"
                    key={avatar.key}
                    className={avatarKey === avatar.key ? styles.selectedAvatar : ""}
                    aria-label={`${avatar.label} 아바타 선택`}
                    onClick={() => setAvatarKey(avatar.key)}
                  >
                    <Image src={avatar.src} alt="" width={64} height={64} unoptimized />
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.fieldSection}>
              <h2>프로필 배경색</h2>
              <div className={styles.colorGrid}>
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={backgroundColor === color ? styles.selectedColor : ""}
                    style={{ backgroundColor: color }}
                    aria-label={`${color} 배경색 선택`}
                    onClick={() => setBackgroundColor(color)}
                  />
                ))}
              </div>
            </section>

            <section className={styles.textField}>
              <label htmlFor="communityNickname">닉네임</label>
              <span>{communityNickname.length}/12</span>
              <input
                id="communityNickname"
                value={communityNickname}
                maxLength={12}
                onChange={(event) => setCommunityNickname(event.target.value.slice(0, 12))}
              />
              <p>닉네임을 변경하세요.(커뮤니티에서 사용하는 이름이에요.)</p>
            </section>

            <section className={styles.textField}>
              <label htmlFor="statusMessage">상태 메시지</label>
              <span>{statusMessage.length}/30</span>
              <input
                id="statusMessage"
                value={statusMessage}
                maxLength={30}
                placeholder="커뮤니티에서 사용하는 상태 메시지를 입력하세요."
                onChange={(event) => setStatusMessage(event.target.value.slice(0, 30))}
              />
              <p>프로필과 게시글에 함께 보여요. (선택)</p>
            </section>

            <section className={styles.choiceSection}>
              <h2>성별</h2>
              <div>
                {GENDERS.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    className={gender === item.value ? styles.selectedChip : ""}
                    onClick={() => setGender(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.choiceSection}>
              <h2>연령</h2>
              <div>
                {AGE_GROUPS.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    className={ageGroup === item.value ? styles.selectedChip : ""}
                    onClick={() => setAgeGroup(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <div className={styles.privateNotice}>
              🔒 성별과 연령은 노출되지 않습니다.
              <br />
              성별·연령대는 같은 조건의 인기 글을 추천하는 데만 쓰여요.
            </div>

            {message ? <p className={styles.message}>{message}</p> : null}

            <button
              type="button"
              className={styles.saveButton}
              disabled={saving}
              onClick={saveProfile}
            >
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </>
        )}
      </main>
      <AppFooter active="my" />
    </div>
  );
}
