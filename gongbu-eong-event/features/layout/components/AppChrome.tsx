"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { EventMenuDrawer } from "./EventMenuDrawer";
import { TicketRewardAlert } from "./TicketRewardAlert";
import styles from "./AppChrome.module.css";

const mainAppUrl =
  process.env.NEXT_PUBLIC_MAIN_APP_URL ||
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  "http://localhost:3000";

function mainHref(path: string) {
  return new URL(path, mainAppUrl).toString();
}

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
  const pathname = usePathname();
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
  const effectiveCommunityActivityRewardProgress =
    user?.communityActivityRewardProgress ?? fetchedUser?.communityActivityRewardProgress;

  useEffect(() => {
    const requiresSignupAgreements =
      user?.status === "pending_signup" || user?.signupCompletedAt === null;

    if (requiresSignupAgreements && pathname !== "/signup/agreements") {
      const next = pathname || "/";
      window.location.href = mainHref(`/signup/agreements?next=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, user]);

  useEffect(() => {
    let active = true;
    const showPendingReward = (
      message: string,
      balanceAfter?: number,
      progress?: CurrentUserDto["communityActivityRewardProgress"],
    ) => {
      window.setTimeout(() => {
        if (!active) return;
        if (typeof balanceAfter === "number" || progress) {
          setFetchedUser((current) =>
            current
              ? {
                  ...current,
                  creditBalance:
                    typeof balanceAfter === "number" ? balanceAfter : current.creditBalance,
                  communityActivityRewardProgress:
                    progress ?? current.communityActivityRewardProgress,
                }
              : current,
          );
          window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
            detail: { balance: balanceAfter, progress },
          }));
        }
        setTicketRewardMessage(message);
      }, 0);
    };

    const pendingReward = window.sessionStorage.getItem("gongbu_pending_ticket_reward");
    if (pendingReward) {
      window.sessionStorage.removeItem("gongbu_pending_ticket_reward");
      try {
        const parsed = JSON.parse(pendingReward) as {
          message?: string;
          balanceAfter?: number;
          progress?: CurrentUserDto["communityActivityRewardProgress"];
        };
        showPendingReward(
          parsed.message || "진단권 한장이 추가되었습니다.",
          parsed.balanceAfter,
          parsed.progress,
        );
      } catch {
        showPendingReward("진단권 한장이 추가되었습니다.");
      }
    }

    const handleReward = (event: Event) => {
      const detail = (event as CustomEvent<{
        message?: string;
        balanceAfter?: number;
        progress?: CurrentUserDto["communityActivityRewardProgress"];
      }>).detail;
      if (typeof detail?.balanceAfter === "number" || detail?.progress) {
        setFetchedUser((current) =>
          current
            ? {
                ...current,
                creditBalance:
                  typeof detail.balanceAfter === "number"
                    ? detail.balanceAfter
                    : current.creditBalance,
                communityActivityRewardProgress:
                  detail.progress ?? current.communityActivityRewardProgress,
              }
            : current,
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
      window.location.href = mainHref("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerGroup}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          className={`${styles.headerButton} ${styles.headerButtonBack}`}
        >
          <FigmaHeaderIcon kind="back" />
        </button>
        <Link
          href={mainHref("/")}
          aria-label="홈으로 이동"
          className={`${styles.headerButton} ${styles.headerButtonHome}`}
        >
          <FigmaHeaderIcon kind="home" />
        </Link>
      </div>
      <div className={styles.headerActions}>
        {showTicketStatus && isAuthenticated ? (
          <AppTicketStatus
            ticketCount={effectiveTicketCount}
            hasTicketAlert={hasTicketAlert}
            communityActivityRewardProgress={effectiveCommunityActivityRewardProgress}
          />
        ) : null}
        <button
          type="button"
          aria-label="메인 메뉴"
          aria-expanded={isMenuOpen}
          className={`${styles.headerButton} ${styles.headerButtonMenu}`}
          onClick={() => setIsMenuOpen(true)}
        >
          <FigmaHeaderIcon kind="menu" />
        </button>
      </div>

      {isMenuOpen ? (
        <EventMenuDrawer
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

export function AppTicketStatus({
  ticketCount = 10,
  hasTicketAlert = true,
  communityActivityRewardProgress,
}: {
  ticketCount?: number;
  hasTicketAlert?: boolean;
  communityActivityRewardProgress?: CurrentUserDto["communityActivityRewardProgress"];
}) {
  const [eventTicketCount, setEventTicketCount] = useState<number | null>(null);
  const [eventProgress, setEventProgress] = useState<CurrentUserDto["communityActivityRewardProgress"] | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const displayTicketCount = eventTicketCount ?? ticketCount;
  const progress = eventProgress ?? communityActivityRewardProgress;
  const currentProgressCount = progress?.currentCount ?? 0;
  const milestoneCount = progress?.milestoneCount ?? 5;
  const isMaxed = Boolean(progress?.isMaxed || displayTicketCount >= 20);
  const progressPercent = isMaxed
    ? 0
    : Math.max(0, Math.min(100, progress?.percent ?? 0));

  useEffect(() => {
    const handleBalanceChange = (event: Event) => {
      const detail = (event as CustomEvent<{
        balance?: number;
        balanceAfter?: number;
        progress?: CurrentUserDto["communityActivityRewardProgress"];
      }>).detail;
      const balance = detail?.balance;
      const balanceAfter = detail?.balanceAfter;
      const nextBalance = typeof balanceAfter === "number" ? balanceAfter : balance;
      if (typeof nextBalance === "number") {
        setEventTicketCount(nextBalance);
      }
      if (detail?.progress) {
        setEventProgress(detail.progress);
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
    <div
      className={styles.headerTicketStatus}
      aria-label={
        isMaxed
          ? `보유 진단권 ${displayTicketCount}개, 최대 보유 수량 도달`
          : `보유 진단권 ${displayTicketCount}개, 커뮤니티 활동 보상 ${currentProgressCount}/${milestoneCount}`
      }
    >
      <span className={styles.headerTicketProgress} aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </span>
      <Image src="/layout/header-ticket.png" alt="" width={23} height={12} className={styles.headerTicketIcon} />
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
          <Image src="/layout/header-alert-bg.svg" alt="" width={16} height={16} />
          <b>!</b>
          {isTooltipOpen ? (
            <span className={styles.headerTicketTooltip} role="tooltip">
              {isMaxed
                ? "진단권은 최대 20장까지 보유할 수 있습니다."
                : "커뮤니티에서 댓글과 글을 작성하면, 진단권이 추가됩니다."}
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
      window.location.href = mainHref(href);
      return;
    }

    if (isAuthenticated === null) {
      try {
        const response = await getCurrentUser();
        if (response.authenticated) {
          setIsAuthenticated(true);
          window.location.href = mainHref(href);
          return;
        }
      } catch {
        // fall through to the login required alert.
      }
      setIsAuthenticated(false);
    }

    window.location.href = mainHref("/login");
  };

  return (
    <footer className={styles.footer}>
      <Link href={mainHref("/")} className={active === "home" ? styles.active : undefined}>
        <Image src="/diagnosis/result-detail/footer-home.svg" alt="" width={25} height={26} />
        <span>홈</span>
      </Link>
      <Link href={mainHref("/calendar")} className={active === "calendar" ? styles.active : undefined}>
        <Image src="/diagnosis/result-detail/footer-calendar.svg" alt="" width={24} height={26} />
        <span>캘린더</span>
      </Link>
      <button
        type="button"
        className={active === "ai" ? styles.active : undefined}
        onClick={() => {
          window.location.href = mainHref("/ai-tools");
        }}
      >
        <span className={styles.footerIconWrap}>
          <Image src="/diagnosis/result-detail/footer-ai.svg" alt="" width={27} height={27} />
          <b className={styles.footerBest}>BEST</b>
        </span>
        <span>AI 도구</span>
      </button>
      <Link href={mainHref("/community")} className={active === "community" ? styles.active : undefined}>
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

type FigmaHeaderIconKind = "back" | "home" | "menu";

const headerIconAssets: Record<
  FigmaHeaderIconKind,
  { src: string; width: number; height: number }
> = {
  back: { src: "/layout/header-home.svg", width: 13, height: 22 },
  home: { src: "/layout/header-back.svg", width: 22, height: 22 },
  menu: { src: "/layout/header-menu.svg", width: 22, height: 15 },
};

function FigmaHeaderIcon({ kind }: { kind: FigmaHeaderIconKind }) {
  const icon = headerIconAssets[kind];

  return (
    <Image
      src={icon.src}
      alt=""
      width={icon.width}
      height={icon.height}
      className={styles.figmaHeaderIcon}
      aria-hidden="true"
      unoptimized
    />
  );
}
