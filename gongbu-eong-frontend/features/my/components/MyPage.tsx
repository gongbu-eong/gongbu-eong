"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDiagnosisResultHistory } from "@/features/diagnosis/diagnosis.api";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listResumes } from "../my.api";
import { listCoachingHistory } from "@/features/coaching/coaching.api";
import styles from "./My.module.css";

export function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [resumeCount, setResumeCount] = useState(0);
  const [diagnosisCount, setDiagnosisCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [coverLetterCoachingCount, setCoverLetterCoachingCount] = useState(0);
  const interviewCoachingCount = 0;

  useEffect(() => {
    let alive = true;

    Promise.all([
      getCurrentUser().catch(() => null),
      getHomeJobs().catch(() => null),
      listResumes().catch(() => null),
      getDiagnosisResultHistory(undefined, 1).catch(() => null),
      listCoachingHistory().catch(() => null),
    ]).then(([userResponse, jobsResponse, resumesResponse, diagnosisResponse, coachingResponse]) => {
      if (!alive) return;
      setUser(userResponse?.authenticated ? userResponse.user : null);
      setBookmarkCount(jobsResponse?.bookmarkCount ?? 0);
      setResumeCount(resumesResponse?.resumes.length ?? 0);
      setDiagnosisCount(diagnosisResponse?.totalCount ?? 0);
      setCoverLetterCoachingCount(coachingResponse?.items.length ?? 0);
    });

    return () => {
      alive = false;
    };
  }, []);

  const nickname = useMemo(
    () => user?.nickname || user?.displayName || "회원",
    [user],
  );

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
          <div className={styles.avatar} aria-hidden="true">
            <Image src="/my/profile-avatar-bg.svg" alt="" width={64} height={64} />
            <span>🐵</span>
          </div>
          <div>
            <strong className={styles.profileName}>{nickname}</strong>
            <p className={styles.profileText}>프로필을 수정 할 수 있습니다.</p>
          </div>
          <button type="button" className={styles.editButton}>
            편집
          </button>
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
          <div className={styles.stat}>
            <strong>{interviewCoachingCount}</strong>
            <span>면접 코칭</span>
          </div>
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
          <MyMenuItem
            href="#"
            iconSrc="/my/activity-interview.png"
            iconWidth={17}
            iconHeight={30}
            title="내 면접 코칭 기록"
            count={interviewCoachingCount}
          />
          <MyMenuItem
            href="/my/resumes"
            iconSrc="/my/activity-resume.png"
            iconWidth={23}
            iconHeight={30}
            title="내 이력서 관리"
            count={resumeCount || undefined}
          />
        </nav>

        <h2 className={styles.sectionTitle}>설정</h2>
        <nav className={styles.menuList} aria-label="설정">
          <MyMenuItem href="#" iconSrc="/my/setting-notification.png" iconWidth={26} iconHeight={30} title="알림 설정" />
          <MyMenuItem href="#" iconSrc="/my/setting-ticket.png" iconWidth={30} iconHeight={21} title="진단권 결제" />
          <MyMenuItem
            href="#"
            iconSrc="/my/setting-payment-history.png"
            iconWidth={24}
            iconHeight={26}
            title="결제 내역"
          />
          <MyMenuItem href="#" iconSrc="/my/setting-support.png" iconWidth={30} iconHeight={25} title="고객센터 · 문의" />
          <MyMenuItem href="#" iconSrc="/my/setting-policy.png" iconWidth={25} iconHeight={32} title="약관 및 정책" />
        </nav>

        <h2 className={styles.sectionTitle}>커뮤니티</h2>
        <nav className={styles.menuList} aria-label="커뮤니티">
          <MyMenuItem href="#" iconSrc="/my/community-post.png" iconWidth={26} iconHeight={26} title="내 글 확인하기" />
          <MyMenuItem href="#" iconSrc="/my/community-comment.png" iconWidth={28} iconHeight={27} title="내 댓글 확인하기" />
          <MyMenuItem href="#" iconSrc="/my/community-scrap.png" iconWidth={19} iconHeight={26} title="스크랩한 글 보기" />
        </nav>

        <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </main>
      <AppFooter active="my" />
    </div>
  );
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
