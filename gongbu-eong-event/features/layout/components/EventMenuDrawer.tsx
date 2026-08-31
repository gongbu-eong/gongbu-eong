"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import type { CurrentUserDto } from "@/features/home/home.dto";
import styles from "./EventMenuDrawer.module.css";

const mainAppUrl =
  process.env.NEXT_PUBLIC_MAIN_APP_URL ||
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  "http://localhost:3000";

function mainHref(path: string) {
  return new URL(path, mainAppUrl).toString();
}

function getRecommendedJobsHref(user: CurrentUserDto | null | undefined) {
  if (!user) return "/login";
  if (!user.diagnosisResultId) return "/jobs?view=recommended";

  const params = new URLSearchParams({
    view: "recommended",
    resultId: user.diagnosisResultId,
  });
  return `/jobs?${params.toString()}`;
}

export function EventMenuDrawer({
  user,
  bookmarkCount = 0,
  isLoggingOut = false,
  onClose,
  onLogout,
}: {
  user?: CurrentUserDto | null;
  bookmarkCount?: number;
  isLoggingOut?: boolean;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const portalRoot = typeof document === "undefined" ? null : document.body;
  const profileNickname = user?.communityNickname || "프로필 닉네임 설정";
  const profileStatusMessage = user?.profileStatusMessage || "프로필을 수정 할 수 있습니다.";
  const profileAvatarSrc = toProfileAvatarSrc(user?.profileAvatarKey);
  const profileBackgroundColor = user?.profileBackgroundColor || "#f5f7fa";

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const hasScrollbar = window.innerWidth > root.clientWidth;
    const previous = {
      rootOverflowX: root.style.overflowX,
      rootOverflowY: root.style.overflowY,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };

    root.style.overflowX = "hidden";
    root.style.overflowY = hasScrollbar ? "scroll" : "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      root.style.overflowX = previous.rootOverflowX;
      root.style.overflowY = previous.rootOverflowY;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const drawer = (
    <aside className={styles.menuOverlay} aria-modal="true" role="dialog" aria-label="메뉴">
      <button type="button" className={styles.menuDim} aria-label="메뉴 닫기" onClick={onClose} />
      <div className={styles.drawer}>
        <header className={styles.drawerHeader}>
          <div
            className={`${styles.drawerAvatar} ${user ? "" : styles.drawerGuestAvatar}`}
            style={user ? { backgroundColor: profileBackgroundColor } : undefined}
            aria-hidden="true"
          >
            {user ? (
              <Image src={profileAvatarSrc} alt="" width={64} height={64} unoptimized />
            ) : (
              <Image src="/home/menu/drawer-guest-avatar.png" alt="" width={64} height={64} unoptimized />
            )}
          </div>
          <div>
            <strong>{user ? profileNickname : "로그인을 해주세요."}</strong>
            {user ? (
              <p>{profileStatusMessage}</p>
            ) : (
              <Link href={mainHref("/login")} className={styles.drawerLoginLink} onClick={onClose}>
                로그인 하기 &gt;
              </Link>
            )}
          </div>
          <button type="button" className={styles.drawerClose} aria-label="메뉴 닫기" onClick={onClose}>
            <Image src="/home/menu/drawer-close.svg" alt="" width={24} height={24} unoptimized />
          </button>
        </header>

        <nav className={styles.drawerNav} aria-label="전체 메뉴">
          <DrawerSection icon="home" title="홈" titleHref="/" onNavigate={onClose} />
          <DrawerSection
            icon="megaphone"
            title="채용 공고"
            items={["채용 공고", "진단결과 추천 공고", "찜한 공고"]}
            hrefs={[
              "/jobs",
              getRecommendedJobsHref(user),
              user ? "/jobs?view=bookmarked" : "/login",
            ]}
            badge={String(bookmarkCount)}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="calendar"
            title="캘린더"
            items={["전체 채용 캘린더", "나만의 캘린더"]}
            hrefs={["/calendar", user ? "/calendar" : "/login"]}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="ai"
            title="AI 도구"
            label="BEST"
            items={["직무 성향 진단", "AI 자소서 코칭"]}
            hrefs={user ? ["/ai-tools/diagnosis", "/ai-tools/coaching"] : ["/ai-tools/diagnosis", "/login"]}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="community"
            title="커뮤니티"
            items={["내 글 · 댓글"]}
            hrefs={user ? ["/community/activity"] : ["/login"]}
            onNavigate={onClose}
          />
          <DrawerSection icon="my" title="마이페이지" titleHref={user ? "/my" : "/login"} onNavigate={onClose} />
        </nav>

        {user ? (
          <button type="button" className={styles.logoutButton} onClick={onLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        ) : null}
      </div>
    </aside>
  );

  return portalRoot ? createPortal(drawer, portalRoot) : null;
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

function DrawerSection({
  icon,
  title,
  items = [],
  hrefs = [],
  titleHref,
  label,
  badge,
  onNavigate,
}: {
  icon: "home" | "megaphone" | "calendar" | "ai" | "community" | "my";
  title: string;
  items?: string[];
  hrefs?: string[];
  titleHref?: string;
  label?: string;
  badge?: string;
  onNavigate?: () => void;
}) {
  return (
    <section className={styles.drawerSection}>
      <div className={styles.drawerIcon} data-icon={icon} aria-hidden="true">
        {getDrawerIcon(icon)}
      </div>
      <div
        className={styles.drawerSectionBody}
        style={
          items.length > 0
            ? ({ "--drawer-line-height": `${Math.max(1, items.length - 1) * 33 + 21}px` } as CSSProperties)
            : undefined
        }
        data-has-items={items.length > 0 ? "true" : undefined}
      >
        <h3>
          {titleHref ? <Link href={mainHref(titleHref)} onClick={onNavigate}>{title}</Link> : title}
          {label ? <span className={styles.drawerLabel}>{label}</span> : null}
        </h3>
        {items.length > 0 ? (
          <ul>
            {items.map((item, index) => (
              <li key={item}>
                <Link href={mainHref(hrefs[index] || "#")} onClick={onNavigate}>
                  {item}
                  {badge && index === items.length - 1 ? <span className={styles.drawerBadge}>{badge}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function getDrawerIcon(icon: "home" | "megaphone" | "calendar" | "ai" | "community" | "my") {
  const drawerIconAssets: Partial<Record<typeof icon, string>> = {
    home: "/home/menu/drawer-home.svg",
    megaphone: "/home/menu/drawer-jobs.svg",
    calendar: "/home/menu/drawer-calendar.svg",
    ai: "/home/menu/drawer-ai.svg",
    community: "/home/menu/drawer-community.svg",
    my: "/home/menu/drawer-my.svg",
  };
  const drawerIconSrc = drawerIconAssets[icon];

  return drawerIconSrc ? <Image src={drawerIconSrc} alt="" width={28} height={28} unoptimized /> : null;
}
