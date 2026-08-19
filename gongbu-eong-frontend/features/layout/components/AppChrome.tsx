"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { HomeMenuDrawer } from "@/features/home/components/HomeMain";
import { ComingSoonAlert } from "./ComingSoonAlert";
import { TicketRewardAlert } from "./TicketRewardAlert";
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
  ticketCount,
  hasTicketAlert = true,
}: AppHeaderProps = {}) {
  const router = useRouter();
  const [fetchedUser, setFetchedUser] = useState<CurrentUserDto | null>(null);
  const [fetchedBookmarkCount, setFetchedBookmarkCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [ticketRewardMessage, setTicketRewardMessage] = useState("");

  useEffect(() => {
    const shouldFetchUser =
      userProp === undefined ||
      (showTicketStatus &&
        ticketCount === undefined &&
        userProp !== null &&
        userProp.creditBalance === undefined);
    const shouldFetchHome = bookmarkCountProp === undefined;

    if (!shouldFetchUser && !shouldFetchHome) return;

    let active = true;
    Promise.all([
      shouldFetchUser ? getCurrentUser().catch(() => null) : Promise.resolve(null),
      shouldFetchHome ? getHomeJobs().catch(() => null) : Promise.resolve(null),
    ]).then(([userResponse, homeResponse]) => {
      if (!active) return;
      if (userResponse?.authenticated) {
        setFetchedUser(userResponse.user);
      } else if (shouldFetchUser && userResponse) {
        setFetchedUser(null);
      }
      if (shouldFetchHome && homeResponse) {
        setFetchedBookmarkCount(homeResponse.bookmarkCount ?? 0);
      }
    });

    return () => {
      active = false;
    };
  }, [bookmarkCountProp, showTicketStatus, ticketCount, userProp]);

  const user = userProp !== undefined ? userProp : fetchedUser;
  const bookmarkCount =
    bookmarkCountProp !== undefined ? bookmarkCountProp : fetchedBookmarkCount;
  const isAuthenticated = Boolean(user);
  const effectiveTicketCount =
    ticketCount ?? user?.creditBalance ?? fetchedUser?.creditBalance ?? 0;
  const effectiveUnreadNotificationCount =
    user?.unreadNotificationCount ?? fetchedUser?.unreadNotificationCount ?? 0;

  useEffect(() => {
    let active = true;
    const showPendingReward = (message: string, balanceAfter?: number) => {
      window.setTimeout(() => {
        if (!active) return;
        if (typeof balanceAfter === "number") {
          setFetchedUser((current) =>
            current ? { ...current, creditBalance: balanceAfter } : current,
          );
          window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
            detail: { balance: balanceAfter },
          }));
        }
        setTicketRewardMessage(message);
      }, 0);
    };

    const pendingReward = window.sessionStorage.getItem("gongbu_pending_ticket_reward");
    if (pendingReward) {
      window.sessionStorage.removeItem("gongbu_pending_ticket_reward");
      try {
        const parsed = JSON.parse(pendingReward) as { message?: string; balanceAfter?: number };
        showPendingReward(parsed.message || "진단권 한장이 추가되었습니다.", parsed.balanceAfter);
      } catch {
        showPendingReward("진단권 한장이 추가되었습니다.");
      }
    }

    const handleReward = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; balanceAfter?: number }>).detail;
      if (typeof detail?.balanceAfter === "number") {
        setFetchedUser((current) =>
          current ? { ...current, creditBalance: detail.balanceAfter } : current,
        );
      }
      setTicketRewardMessage(detail?.message || "진단권 한장이 추가되었습니다.");
    };

    window.addEventListener("gongbu-ticket-rewarded", handleReward);
    return () => {
      active = false;
      window.removeEventListener("gongbu-ticket-rewarded", handleReward);
    };
  }, []);

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
          <AppTicketStatus ticketCount={effectiveTicketCount} hasTicketAlert={hasTicketAlert} />
        ) : null}
        {/*
        {isAuthenticated ? (
          <Link href="/notifications" aria-label="알림" className={`${styles.headerButton} ${styles.notificationButton}`}>
            <FigmaHeaderIcon kind="bell" />
            {effectiveUnreadNotificationCount ? (
              <span className={styles.notificationBadge}>
                {formatBadgeCount(effectiveUnreadNotificationCount)}
              </span>
            ) : null}
          </Link>
        ) : null}
        */}
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
      {ticketRewardMessage ? (
        <TicketRewardAlert
          message={ticketRewardMessage}
          onClose={() => setTicketRewardMessage("")}
        />
      ) : null}
    </header>
  );
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function AppTicketStatus({
  ticketCount = 10,
  hasTicketAlert = true,
}: {
  ticketCount?: number;
  hasTicketAlert?: boolean;
}) {
  const [eventTicketCount, setEventTicketCount] = useState<number | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const displayTicketCount = eventTicketCount ?? ticketCount;

  useEffect(() => {
    const handleBalanceChange = (event: Event) => {
      const balance = (event as CustomEvent<{ balance?: number; balanceAfter?: number }>).detail?.balance;
      const balanceAfter = (event as CustomEvent<{ balance?: number; balanceAfter?: number }>).detail?.balanceAfter;
      const nextBalance = typeof balanceAfter === "number" ? balanceAfter : balance;
      if (typeof nextBalance === "number") {
        setEventTicketCount(nextBalance);
      }
    };

    window.addEventListener("gongbu-ticket-balance-changed", handleBalanceChange);
    window.addEventListener("gongbu-ticket-rewarded", handleBalanceChange);
    return () => {
      window.removeEventListener("gongbu-ticket-balance-changed", handleBalanceChange);
      window.removeEventListener("gongbu-ticket-rewarded", handleBalanceChange);
    };
  }, []);

  return (
    <div className={styles.headerTicketStatus} aria-label={`보유 진단권 ${displayTicketCount}개`}>
      <span className={styles.headerTicketProgress} aria-hidden="true" />
      <Image src="/my/header-score.png" alt="" width={23} height={12} className={styles.headerTicketIcon} />
      <span className={styles.headerTicketCount}>{displayTicketCount}</span>
      {hasTicketAlert ? (
        <button
          type="button"
          className={styles.headerTicketAlert}
          aria-label="진단권 안내"
          aria-expanded={isTooltipOpen}
          onBlur={() => setIsTooltipOpen(false)}
          onClick={() => setIsTooltipOpen((value) => !value)}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
        >
          <Image src="/my/header-alert-bg.svg" alt="" width={16} height={16} />
          <b>!</b>
          {isTooltipOpen ? (
            <span className={styles.headerTicketTooltip} role="tooltip">
              커뮤니티에서 댓글과 글을 작성하면, 진단권이 추가됩니다.
            </span>
          ) : null}
        </button>
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
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);

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
    router.push("/login");
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
        onClick={() => setIsComingSoonOpen(true)}
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
      {isComingSoonOpen ? (
        <ComingSoonAlert onClose={() => setIsComingSoonOpen(false)} />
      ) : null}
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
