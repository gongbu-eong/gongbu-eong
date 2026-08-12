"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDiagnosisResultHistory } from "@/features/diagnosis/diagnosis.api";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { JobFooter, JobHeader } from "@/features/jobs/components/JobChrome";
import { listResumes } from "../my.api";
import styles from "./My.module.css";

export function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [resumeCount, setResumeCount] = useState(0);
  const [diagnosisCount, setDiagnosisCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([
      getCurrentUser().catch(() => null),
      getHomeJobs().catch(() => null),
      listResumes().catch(() => null),
      getDiagnosisResultHistory(undefined, 1).catch(() => null),
    ]).then(([userResponse, jobsResponse, resumesResponse, diagnosisResponse]) => {
      if (!alive) return;
      setUser(userResponse?.authenticated ? userResponse.user : null);
      setBookmarkCount(jobsResponse?.bookmarkCount ?? 0);
      setResumeCount(resumesResponse?.resumes.length ?? 0);
      setDiagnosisCount(diagnosisResponse?.totalCount ?? 0);
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
    <div className={styles.page}>
      <JobHeader user={user} nickname={nickname} bookmarkCount={bookmarkCount} />
      <main className={styles.frame}>
        <h1 className={styles.title}>마이페이지</h1>

        <section className={styles.profile} aria-label="프로필">
          <div className={styles.avatar} aria-hidden="true">
            🐵
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
            <strong>0</strong>
            <span>자소서 코칭</span>
          </div>
          <div className={styles.stat}>
            <strong>0</strong>
            <span>면접 코칭</span>
          </div>
        </section>

        <h2 className={styles.sectionTitle}>내 활동</h2>
        <nav className={styles.menuList} aria-label="내 활동">
          <MyMenuItem href="/my/diagnosis-results" icon="✅" title="강점·성향 진단 결과" count={diagnosisCount} />
          <MyMenuItem href="/jobs?view=bookmarked" icon="🎟️" title="찜한 공고" count={bookmarkCount} />
          <MyMenuItem href="#" icon="📝" title="내 자소서 코칭 기록" count={0} />
          <MyMenuItem href="#" icon="🎙️" title="내 면접 코칭 기록" count={0} />
          <MyMenuItem href="/my/resumes" icon="📄" title="내 이력서 관리" count={resumeCount || undefined} />
        </nav>

        <h2 className={styles.sectionTitle}>설정</h2>
        <nav className={styles.menuList} aria-label="설정">
          <MyMenuItem href="#" icon="🔔" title="알림 설정" />
          <MyMenuItem href="#" icon="💳" title="크레딧 · 결제" />
          <MyMenuItem href="#" icon="💬" title="고객센터 · 문의" />
          <MyMenuItem href="#" icon="📋" title="약관 및 정책" />
        </nav>

        <h2 className={styles.sectionTitle}>커뮤니티</h2>
        <nav className={styles.menuList} aria-label="커뮤니티">
          <MyMenuItem href="#" icon="✏️" title="내 글 확인하기" />
          <MyMenuItem href="#" icon="💬" title="내 댓글 확인하기" />
          <MyMenuItem href="#" icon="🔖" title="스크랩한 글 보기" />
        </nav>

        <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </main>
      <JobFooter active="my" />
    </div>
  );
}

function MyMenuItem({
  href,
  icon,
  title,
  count,
}: {
  href: string;
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <Link href={href} className={styles.menuItem}>
      <span className={styles.menuIcon} aria-hidden="true">
        {icon}
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
