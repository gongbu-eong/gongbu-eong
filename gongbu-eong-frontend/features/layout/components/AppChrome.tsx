"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { HomeMenuDrawer } from "@/features/home/components/HomeMain";
import styles from "./AppChrome.module.css";

type AppHeaderProps = {
  user?: CurrentUserDto | null;
  nickname?: string;
  bookmarkCount?: number;
  showTicketStatus?: boolean;
  ticketCount?: number;
  hasTicketAlert?: boolean;
};

export function AppHeader({
  user: userProp,
  bookmarkCount: bookmarkCountProp,
  showTicketStatus = true,
  ticketCount = 10,
  hasTicketAlert = true,
}: AppHeaderProps = {}) {
  const router = useRouter();
  const [fetchedUser, setFetchedUser] = useState<CurrentUserDto | null>(null);
  const [fetchedBookmarkCount, setFetchedBookmarkCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (userProp !== undefined && bookmarkCountProp !== undefined) return;

    let active = true;
    Promise.all([
      userProp === undefined ? getCurrentUser().catch(() => null) : Promise.resolve(null),
      bookmarkCountProp === undefined ? getHomeJobs().catch(() => null) : Promise.resolve(null),
    ]).then(([userResponse, homeResponse]) => {
      if (!active) return;
      if (userProp === undefined && userResponse) {
        setFetchedUser(userResponse.authenticated ? userResponse.user : null);
      }
      if (bookmarkCountProp === undefined && homeResponse) {
        setFetchedBookmarkCount(homeResponse.bookmarkCount ?? 0);
      }
    });

    return () => {
      active = false;
    };
  }, [bookmarkCountProp, userProp]);

  const user = userProp !== undefined ? userProp : fetchedUser;
  const bookmarkCount =
    bookmarkCountProp !== undefined ? bookmarkCountProp : fetchedBookmarkCount;
  const isAuthenticated = Boolean(user);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logoutCurrentUser();
      setFetchedUser(null);
      setIsMenuOpen(false);
      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerGroup}>
        <button type="button" onClick={() => router.back()} aria-label="뒤로 가기" className={styles.headerButton}>
          <FigmaHeaderIcon kind="back" />
        </button>
        <Link href="/" aria-label="홈으로 이동" className={styles.headerButton}>
          <FigmaHeaderIcon kind="home" />
        </Link>
      </div>
      <div className={styles.headerActions}>
        {showTicketStatus && isAuthenticated ? (
          <AppTicketStatus ticketCount={ticketCount} hasTicketAlert={hasTicketAlert} />
        ) : null}
        {isAuthenticated ? (
          <button type="button" aria-label="알림" className={styles.headerButton}>
            <FigmaHeaderIcon kind="bell" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="메인 메뉴"
          aria-expanded={isMenuOpen}
          className={styles.headerButton}
          onClick={() => setIsMenuOpen(true)}
        >
          <FigmaHeaderIcon kind="menu" />
        </button>
      </div>

      {isMenuOpen ? (
        <HomeMenuDrawer
          user={user}
          bookmarkCount={bookmarkCount}
          isLoggingOut={isLoggingOut}
          onClose={() => setIsMenuOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}
    </header>
  );
}

export function AppTicketStatus({
  ticketCount = 10,
  hasTicketAlert = true,
}: {
  ticketCount?: number;
  hasTicketAlert?: boolean;
}) {
  return (
    <div className={styles.headerTicketStatus} aria-label={`보유 진단권 ${ticketCount}개`}>
      <span className={styles.headerTicketProgress} aria-hidden="true" />
      <Image src="/my/header-score.png" alt="" width={23} height={12} className={styles.headerTicketIcon} />
      <span className={styles.headerTicketCount}>{ticketCount}</span>
      {hasTicketAlert ? (
        <span className={styles.headerTicketAlert} aria-hidden="true">
          <Image src="/my/header-alert-bg.svg" alt="" width={16} height={16} />
          <b>!</b>
        </span>
      ) : null}
    </div>
  );
}

export function AppFooter({
  active,
}: {
  active?: "home" | "calendar" | "ai" | "community" | "my";
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((response) => {
        if (active) setIsAuthenticated(response.authenticated);
      })
      .catch(() => {
        if (active) setIsAuthenticated(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const goProtected = async (href: string) => {
    if (isAuthenticated === true) {
      router.push(href);
      return;
    }

    if (isAuthenticated === null) {
      try {
        const response = await getCurrentUser();
        if (response.authenticated) {
          setIsAuthenticated(true);
          router.push(href);
          return;
        }
      } catch {
        // fall through to the login required alert.
      }
      setIsAuthenticated(false);
    }

    window.alert("로그인이 필요한 서비스입니다.");
  };

  return (
    <footer className={styles.footer}>
      <Link href="/" className={active === "home" ? styles.active : undefined}>
        <Image src="/diagnosis/result-detail/footer-home.svg" alt="" width={25} height={26} />
        <span>홈</span>
      </Link>
      <Link href="/calendar" className={active === "calendar" ? styles.active : undefined}>
        <Image src="/diagnosis/result-detail/footer-calendar.svg" alt="" width={24} height={26} />
        <span>캘린더</span>
      </Link>
      <button
        type="button"
        className={active === "ai" ? styles.active : undefined}
        onClick={() => goProtected("/ai-tools/diagnosis")}
      >
        <span className={styles.footerIconWrap}>
          <Image src="/diagnosis/result-detail/footer-ai.svg" alt="" width={27} height={27} />
          <b className={styles.footerBest}>BEST</b>
        </span>
        <span>AI 도구</span>
      </button>
      <Link href="/community" className={active === "community" ? styles.active : undefined}>
        <Image src="/diagnosis/result-detail/footer-community.svg" alt="" width={28} height={24} />
        <span>커뮤니티</span>
      </Link>
      <button
        type="button"
        className={active === "my" ? styles.active : undefined}
        onClick={() => goProtected("/my")}
      >
        <Image src="/diagnosis/result-detail/footer-my.svg" alt="" width={28} height={25} />
        <span>MY</span>
      </button>
    </footer>
  );
}

type FigmaHeaderIconKind = "back" | "home" | "bell" | "menu";

function FigmaHeaderIcon({ kind }: { kind: FigmaHeaderIconKind }) {
  return (
    <span className={`${styles.figmaHeaderIcon} ${styles[`figmaHeaderIcon_${kind}`]}`} aria-hidden="true">
      <Image src="/diagnosis/result-detail/header-group.svg" alt="" width={361} height={22} unoptimized />
    </span>
  );
}
