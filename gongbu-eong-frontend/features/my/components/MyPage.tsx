"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDiagnosisResultHistory } from "@/features/diagnosis/diagnosis.api";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listCoachingHistory } from "@/features/coaching/coaching.api";
import styles from "./My.module.css";

export function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  // const [resumeCount, setResumeCount] = useState(0);
  const [diagnosisCount, setDiagnosisCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [coverLetterCoachingCount, setCoverLetterCoachingCount] = useState(0);
  // const interviewCoachingCount = 0;

  useEffect(() => {
    let alive = true;

    async function loadMyPage() {
      const userResponse = await getCurrentUser().catch(() => null);

      if (!alive) return;

      if (!userResponse?.authenticated || !userResponse.user) {
        window.alert("로그인이 필요한 서비스입니다.");
        router.replace("/login");
        return;
      }

      setUser(userResponse.user);

      const [jobsResponse, diagnosisResponse, coachingResponse] = await Promise.all([
        getHomeJobs().catch(() => null),
        getDiagnosisResultHistory(undefined, 1).catch(() => null),
        listCoachingHistory().catch(() => null),
      ]);

      if (!alive) return;

      setBookmarkCount(jobsResponse?.bookmarkCount ?? 0);
      // setResumeCount(resumesResponse?.resumes.length ?? 0);
      setDiagnosisCount(diagnosisResponse?.totalCount ?? 0);
      setCoverLetterCoachingCount(coachingResponse?.items.length ?? 0);
      setIsCheckingAuth(false);
    }

    void loadMyPage();

    return () => {
      alive = false;
    };
  }, [router]);

  const nickname = useMemo(
    () => user?.communityNickname || "프로필 닉네임 설정",
    [user],
  );
  const profileStatusMessage = user?.profileStatusMessage || "프로필을 수정 할 수 있습니다.";
  const profileAvatarSrc = toProfileAvatarSrc(user?.profileAvatarKey);
  const profileBackgroundColor = user?.profileBackgroundColor || "#f5f7fa";

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutCurrentUser();
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <div className={`${styles.page} ${styles.myPage}`}>
      <AppHeader
        user={user}
        nickname={nickname}
        bookmarkCount={bookmarkCount}
      />
      <main className={styles.frame}>
        <h1 className={styles.title}>마이페이지</h1>

        <section className={styles.profile} aria-label="프로필">
          <div className={styles.avatar} style={{ backgroundColor: profileBackgroundColor }} aria-hidden="true">
            <Image src={profileAvatarSrc} alt="" width={64} height={64} unoptimized />
          </div>
          <div>
            <strong className={styles.profileName}>{nickname}</strong>
            <p className={styles.profileText}>{profileStatusMessage}</p>
          </div>
          <Link href="/my/profile" className={styles.editButton}>
            편집
          </Link>
        </section>

        <section className={styles.stats} aria-label="활동 요약">
          <div className={styles.stat}>
            <strong>{bookmarkCount}</strong>
            <span>찜한 공고</span>
          </div>
          <div className={styles.stat}>
            <strong>{coverLetterCoachingCount}</strong>
            <span>자소서 코칭</span>
          </div>
          {/*
          <div className={styles.stat}>
            <strong>{interviewCoachingCount}</strong>
            <span>면접 코칭</span>
          </div>
          */}
        </section>

        <h2 className={styles.sectionTitle}>내 활동</h2>
        <nav className={styles.menuList} aria-label="내 활동">
          <MyMenuItem
            href="/my/diagnosis-results"
            iconSrc="/my/activity-diagnosis.png"
            iconWidth={28}
            iconHeight={28}
            title="강점·성향 진단 결과"
            count={diagnosisCount}
          />
          <MyMenuItem
            href="/jobs?view=bookmarked"
            iconSrc="/my/activity-bookmark.png"
            iconWidth={30}
            iconHeight={30}
            title="찜한 공고"
            count={bookmarkCount}
          />
          <MyMenuItem
            href="/my/coaching"
            iconSrc="/my/activity-cover-letter.png"
            iconWidth={28}
            iconHeight={30}
            title="내 자소서 코칭 기록"
            count={coverLetterCoachingCount}
          />
          {/*
          <MyMenuItem
            href="#"
            iconSrc="/my/activity-interview.png"
            iconWidth={17}
            iconHeight={30}
            title="내 면접 코칭 기록"
            count={interviewCoachingCount}
          />
          */}
          {/*
          <MyMenuItem
            href="/my/resumes"
            iconSrc="/my/activity-resume.png"
            iconWidth={23}
            iconHeight={30}
            title="내 이력서 관리"
            count={resumeCount || undefined}
          />
          */}
        </nav>

        <h2 className={styles.sectionTitle}>설정</h2>
        <nav className={styles.menuList} aria-label="설정">
          {/*
          <MyMenuItem href="/my/notifications" iconSrc="/my/setting-notification.png" iconWidth={26} iconHeight={30} title="알림 설정" />
          <MyMenuItem href="#" iconSrc="/my/setting-ticket.png" iconWidth={30} iconHeight={21} title="진단권 결제" />
          <MyMenuItem
            href="#"
            iconSrc="/my/setting-payment-history.png"
            iconWidth={24}
            iconHeight={26}
            title="결제 내역"
          />
          <MyMenuItem href="#" iconSrc="/my/setting-support.png" iconWidth={30} iconHeight={25} title="고객센터 · 문의" />
          */}
          <MyMenuItem href="/my/policies" iconSrc="/my/setting-policy.png" iconWidth={25} iconHeight={32} title="약관 및 정책" />
        </nav>

        <h2 className={styles.sectionTitle}>커뮤니티</h2>
        <nav className={styles.menuList} aria-label="커뮤니티">
          <MyMenuItem href="/community/activity?tab=posts" iconSrc="/my/community-post.png" iconWidth={26} iconHeight={26} title="내 글 확인하기" />
          <MyMenuItem href="/community/activity?tab=comments" iconSrc="/my/community-comment.png" iconWidth={28} iconHeight={27} title="내 댓글 확인하기" />
          <MyMenuItem href="/community/activity?tab=scraps" iconSrc="/my/community-scrap.png" iconWidth={19} iconHeight={26} title="스크랩한 글 보기" />
        </nav>

        <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </main>
      <AppFooter active="my" />
    </div>
  );
}

function toProfileAvatarSrc(key: string | null | undefined) {
  switch (key) {
    case "fox":
      return "/my/avatars/fox-profile.png?v=3";
    case "lion":
      return "/my/avatars/lion-profile.png?v=3";
    case "cat":
      return "/my/avatars/cat-profile.png?v=3";
    case "penguin":
      return "/my/avatars/penguin-profile.png?v=3";
    case "chick":
      return "/my/avatars/chick-profile.png?v=3";
    case "cow":
      return "/my/avatars/cow-profile.png?v=3";
    case "bear":
      return "/my/avatars/bear-profile.png?v=3";
    case "chicken":
      return "/my/avatars/chicken-profile.png?v=3";
    case "mouse":
      return "/my/avatars/mouse-profile.png?v=3";
    case "monkey":
    default:
      return "/my/avatars/monkey-profile.png?v=3";
  }
}

function MyMenuItem({
  href,
  iconSrc,
  iconWidth,
  iconHeight,
  title,
  count,
}: {
  href: string;
  iconSrc: string;
  iconWidth: number;
  iconHeight: number;
  title: string;
  count?: number;
}) {
  return (
    <Link href={href} className={styles.menuItem}>
      <span className={styles.menuIcon} aria-hidden="true">
        <Image src={iconSrc} alt="" width={iconWidth} height={iconHeight} />
      </span>
      <span className={styles.menuTitle}>
        {title}
        {count !== undefined ? <b className={styles.countBadge}>{count}</b> : null}
      </span>
      <span className={styles.chevron} aria-hidden="true">
        &gt;
      </span>
    </Link>
  );
}
