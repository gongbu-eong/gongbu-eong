"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { HomeMenuDrawer } from "@/features/home/components/HomeMain";
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
      router.replace(`/signup/agreements?next=${encodeURIComponent(next)}`);
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
      router.replace("/");
      router.refresh();
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
          href="/"
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
        {isAuthenticated ? (
          <Link href="/notifications" aria-label="알림" className={styles.headerButton}>
            <BellIcon />
            {user?.unreadNotificationCount ? (
              <span className={styles.notificationBadge}>
                {formatBadgeCount(user.unreadNotificationCount)}
              </span>
            ) : null}
          </Link>
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
      <Link href="/ai-tools" className={active === "ai" ? styles.active : undefined}>
        <span className={styles.footerIconWrap}>
          <Image src="/diagnosis/result-detail/footer-ai.svg" alt="" width={27} height={27} />
          <b className={styles.footerBest}>BEST</b>
        </span>
        <span>AI 도구</span>
      </Link>
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

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="317 13 22 22" aria-hidden="true">
      <path
        d="M338.451 29.2357H338.47L338.284 29.0485C338.191 28.9548 338.089 28.8681 337.982 28.7906L335.303 26.8631V22.1867C335.303 22.1276 335.302 22.0738 335.301 22.0222C335.3 21.9796 335.298 21.933 335.296 21.8805C335.296 21.8745 335.296 21.8679 335.295 21.8618C335.26 21.0601 335.095 20.2748 334.804 19.5293C334.799 19.5144 334.792 19.5004 334.785 19.4862C334.493 18.7508 334.087 18.0729 333.578 17.471C332.712 16.4465 331.584 15.6807 330.314 15.2557C330.31 15.254 330.307 15.2527 330.303 15.2516C330.282 15.2447 330.261 15.2381 330.24 15.2315C330.229 15.228 330.217 15.2244 330.206 15.2205L330.167 15.2082C330.14 15.1997 330.111 15.1912 330.074 15.1804C330.049 15.1728 330.023 15.1653 329.997 15.1579L329.962 15.148L329.926 15.1382C329.89 15.1283 329.853 15.1184 329.815 15.1088L329.793 15.103L329.77 15.0973C329.747 15.0912 329.719 15.0846 329.69 15.0775V14.6895C329.69 14.2839 329.543 13.8913 329.277 13.5843C329.014 13.2806 328.652 13.0799 328.258 13.0195C328.175 13.0066 328.088 13 328.001 13C327.914 13 327.829 13.0066 327.744 13.0192C327.35 13.0799 326.987 13.2803 326.724 13.5843C326.458 13.8913 326.312 14.2837 326.312 14.6895V15.0775C326.285 15.0838 326.259 15.0904 326.232 15.097C326.216 15.1011 326.201 15.1049 326.186 15.1088C326.148 15.1184 326.111 15.1283 326.076 15.1379C326.051 15.1445 326.027 15.1513 326.004 15.1579C325.986 15.1629 325.969 15.1678 325.952 15.173L325.927 15.1804C325.896 15.1892 325.867 15.1983 325.837 15.2074H325.836L325.834 15.2082L325.795 15.2205L325.784 15.2241C325.755 15.2332 325.727 15.2422 325.698 15.2518C325.694 15.2529 325.69 15.2543 325.687 15.256C324.417 15.6813 323.289 16.4471 322.423 17.4713C321.914 18.0729 321.508 18.7508 321.216 19.4864C321.208 19.5021 321.201 19.5164 321.196 19.5304C320.906 20.2753 320.74 21.0606 320.706 21.8638V21.8687C320.706 21.8717 320.706 21.8747 320.705 21.8778V21.8794C320.703 21.9338 320.701 21.9796 320.701 22.0233C320.699 22.0895 320.699 22.14 320.699 22.1875V26.8639L318.02 28.7912C317.912 28.8689 317.81 28.9562 317.716 29.0504C317.261 29.5073 317 30.1385 317 30.7822V31.4016C317 31.8676 317.379 32.2468 317.845 32.2468H324.801C325.038 33.8231 326.396 35 328 35C329.604 35 330.962 33.8231 331.199 32.2468H338.155C338.621 32.2468 339 31.8676 339 31.4016V30.7822C339 30.222 338.802 29.6712 338.451 29.2365L338.451 29.2357ZM330.215 32.246C329.99 33.2712 329.06 34.0294 328.001 34.0294H328.001C326.941 34.0294 326.012 33.2712 325.787 32.246H330.215ZM328.728 15.5585C328.764 15.7562 328.921 15.9136 329.12 15.949C329.145 15.9537 329.171 15.9586 329.197 15.9633C329.21 15.9658 329.223 15.9682 329.236 15.9707C329.247 15.9729 329.259 15.9754 329.271 15.9778C329.283 15.9803 329.296 15.9831 329.308 15.9855C329.322 15.9885 329.336 15.9916 329.351 15.9946L329.359 15.9962C329.381 16.0012 329.403 16.0061 329.425 16.0113C329.446 16.016 329.466 16.0209 329.486 16.0256C329.505 16.0303 329.524 16.0347 329.543 16.0396C329.572 16.0468 329.6 16.0542 329.628 16.0619H329.629L329.63 16.0624C329.64 16.0649 329.649 16.0673 329.659 16.0704C330.903 16.4087 332.002 17.1094 332.837 18.0973C333.735 19.1597 334.264 20.5117 334.326 21.9044C334.326 21.9088 334.326 21.9129 334.327 21.9173C334.329 21.956 334.33 21.9967 334.331 22.045C334.332 22.0928 334.333 22.1392 334.333 22.1872V27.1121C334.333 27.2675 334.408 27.4147 334.534 27.5056L337.415 29.5781C337.494 29.6352 337.57 29.7025 337.639 29.7775C337.892 30.0531 338.031 30.4098 338.031 30.7816V31.2761H317.969V30.7811C317.969 30.4101 318.108 30.054 318.36 29.7788C318.43 29.7022 318.506 29.6347 318.586 29.5778L321.466 27.5053C321.593 27.4144 321.668 27.2672 321.668 27.1116V22.1867C321.668 22.1394 321.668 22.0914 321.67 22.0442C321.671 21.9958 321.672 21.9533 321.674 21.9148V21.906C321.736 20.5123 322.265 19.1594 323.163 18.0968C323.998 17.1088 325.097 16.4078 326.34 16.0701C326.349 16.0676 326.36 16.0649 326.371 16.0621C326.4 16.0544 326.429 16.0468 326.458 16.0393C326.477 16.0344 326.496 16.03 326.515 16.0253C326.535 16.0204 326.555 16.0157 326.575 16.0111C326.598 16.0058 326.62 16.0006 326.642 15.996C326.651 15.994 326.659 15.9921 326.668 15.9905C326.677 15.9885 326.686 15.9866 326.695 15.9847C326.718 15.9798 326.741 15.9748 326.765 15.9701L326.804 15.9627C326.83 15.9578 326.856 15.9528 326.882 15.9482C327.08 15.9125 327.237 15.7554 327.273 15.5569C327.278 15.5278 327.281 15.499 327.281 15.4707V14.6884C327.281 14.2914 327.603 13.9684 328 13.9684C328.397 13.9684 328.72 14.2914 328.72 14.6884V15.4707C328.72 15.5006 328.723 15.53 328.728 15.558V15.5585H328.728Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}
