"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent, PointerEvent } from "react";
import { AppFooter, AppTicketStatus } from "@/features/layout/components/AppChrome";
import { ComingSoonAlert } from "@/features/layout/components/ComingSoonAlert";
import { TicketRewardAlert } from "@/features/layout/components/TicketRewardAlert";
import { getCommunityPosts } from "@/features/community/community.api";
import type { CommunityPostSummaryDto } from "@/features/community/community.dto";
import { getCurrentUser, getHomeJobs, logoutCurrentUser } from "../home.api";
import type {
  CurrentUserDto,
  HomeJobsResponseDto,
  JobPostingDto,
} from "../home.dto";
import styles from "./HomeMain.module.css";

const aiTools = [
  {
    href: "/ai-tools/diagnosis",
    tag: "완전 무료",
    memberTag: "완전 무료",
    title: "강점·성향 진단",
    description: "16문항이면 끝, 내 강점 유형을 알려드려요.",
    image: "/home/home-tool-match.png",
    imageAlt: "강점·성향 진단",
  },
  {
    href: "/ai-tools/coaching",
    tag: "첫 1회 무료",
    memberTag: "첫 5회 무료 쿠폰 증정",
    title: "Ai NCS 자소서 코칭",
    description: "합격하는 문장으로 AI가 다듬어 드려요.",
    image: "/home/home-tool-diagnosis.png",
    imageAlt: "Ai 자소서 코칭",
  },
  {
    href: "#",
    tag: "첫 1회 무료",
    memberTag: "첫 3회 무료 쿠폰 증정",
    title: "Ai 면접 코칭",
    description: "실전처럼 연습하고 면접 울렁증 극복해요.",
    image: "/home/home-tool-resume.png",
    imageAlt: "Ai 면접 코칭",
    comingSoon: true,
  },
  {
    href: "#",
    tag: "준비중",
    memberTag: "준비중",
    title: "탈락사례 분석",
    description: "왜 떨어졌을까? 곧 데이터로 알려드려요.",
    image: "/home/home-tool-interview.png",
    imageAlt: "탈락사례 분석",
    comingSoon: true,
  },
];

const resultCards = {
  stability: {
    names: ["안정 추구형", "안정추구형"],
    image: "/home/result-types/stability.png",
    className: styles.resultOwlStability,
    bannerClassName: styles.resultBannerStability,
  },
  challenge: {
    names: ["도전 개척형", "도전개척형"],
    image: "/home/result-types/challenge.png",
    className: styles.resultOwlChallenge,
    bannerClassName: styles.resultBannerChallenge,
  },
  teamwork: {
    names: ["협업 조력형", "협업조력형"],
    image: "/home/result-types/teamwork.png",
    className: styles.resultOwlTeamwork,
    bannerClassName: styles.resultBannerTeamwork,
  },
  individual: {
    names: ["독립 몰입형", "독립몰입형"],
    image: "/home/result-types/individual.png",
    className: styles.resultOwlIndividual,
    bannerClassName: styles.resultBannerIndividual,
  },
  execution: {
    names: ["실행 추진형", "실행추진형"],
    image: "/home/result-types/execution.png",
    className: styles.resultOwlExecution,
    bannerClassName: styles.resultBannerExecution,
  },
  planning: {
    names: ["전략 기획형", "전략기획형"],
    image: "/home/result-types/planning.png",
    className: styles.resultOwlPlanning,
    bannerClassName: styles.resultBannerPlanning,
  },
  principle: {
    names: ["정밀 관리형", "정밀관리형"],
    image: "/home/result-types/principle.png",
    className: styles.resultOwlPrinciple,
    bannerClassName: styles.resultBannerPrinciple,
  },
  flexibility: {
    names: ["유연 대응형", "유연대응형"],
    image: "/home/result-types/flexibility.png",
    className: styles.resultOwlFlexibility,
    bannerClassName: styles.resultBannerFlexibility,
  },
} as const;

function getWelcomeTicketRewardMessage() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const ticketReward = params.get("ticketReward");
  const ticketAmount = Number(params.get("ticketAmount") || 0);

  if (ticketReward !== "welcome" || ticketAmount <= 0) return "";
  return `진단권 ${ticketAmount}장이 추가되었습니다.`;
}

function clearWelcomeTicketRewardQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("ticketReward") !== "welcome") return;
  params.delete("ticketReward");
  params.delete("ticketAmount");
  const nextQuery = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
  );
}

export function HomeMain({
  initialUser = null,
  authResolved = false,
}: {
  initialUser?: CurrentUserDto | null;
  authResolved?: boolean;
}) {
  const [user, setUser] = useState<CurrentUserDto | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser && !authResolved);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);
  const [ticketRewardMessage, setTicketRewardMessage] = useState(getWelcomeTicketRewardMessage);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [jobs, setJobs] = useState<HomeJobsResponseDto>({
    hotJobs: [],
    recommendedJobs: [],
    recommendationTypeName: null,
    bookmarkCount: 0,
  });
  const [communityPreview, setCommunityPreview] = useState<CommunityPostSummaryDto[]>([]);
  const hotListRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const draggedRef = useRef(false);

  useEffect(() => {
    clearWelcomeTicketRewardQuery();
  }, []);

  useEffect(() => {
    if (initialUser || authResolved) {
      return;
    }

    let mounted = true;

    getCurrentUser()
      .then((response) => {
        if (!mounted) return;
        setUser(response.authenticated ? response.user : null);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authResolved, initialUser]);

  useEffect(() => {
    let mounted = true;

    getHomeJobs()
      .then((response) => {
        if (mounted) setJobs(response);
      })
      .catch(() => {
        if (mounted) {
          setJobs({
            hotJobs: [],
            recommendedJobs: [],
            recommendationTypeName: null,
            bookmarkCount: 0,
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    getCommunityPosts({ limit: 10, sort: "latest" })
      .then((response) => {
        if (mounted) setCommunityPreview(response.items);
      })
      .catch(() => {
        if (mounted) setCommunityPreview([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const nickname = useMemo(() => {
    if (isLoading) return "";
    return user?.nickname || user?.displayName || "회원";
  }, [isLoading, user]);
  const diagnosisTypeName = user?.diagnosisTypeName || "진단 결과 확인";
  const resultCard =
    (user?.diagnosisTypeCode
      ? resultCards[user.diagnosisTypeCode]
      : Object.values(resultCards).find((card) =>
          card.names.some((name) => diagnosisTypeName.includes(name)),
        )) ?? resultCards.stability;
  const resultBannerClassName = `${styles.resultBanner} ${
    user ? resultCard.bannerClassName : styles.loggedOutResultBanner
  }`;

const DRAG_THRESHOLD = 10;

const startHotDrag = (event: PointerEvent<HTMLDivElement>) => {
  // 모바일 터치는 브라우저 기본 스크롤 사용
  if (event.pointerType !== "mouse") return;

  const target = hotListRef.current;
  if (!target) return;

  dragRef.current = {
    isDown: true,
    startX: event.clientX,
    scrollLeft: target.scrollLeft,
  };

  draggedRef.current = false;
};

const moveHotDrag = (event: PointerEvent<HTMLDivElement>) => {
  if (event.pointerType !== "mouse") return;

  const target = hotListRef.current;
  if (!target || !dragRef.current.isDown) return;

  const distance = event.clientX - dragRef.current.startX;

  if (
    !draggedRef.current &&
    Math.abs(distance) > DRAG_THRESHOLD
  ) {
    draggedRef.current = true;
    target.setPointerCapture(event.pointerId);
  }

  if (!draggedRef.current) return;

  event.preventDefault();
  target.scrollLeft = dragRef.current.scrollLeft - distance;
};

const endHotDrag = (event: PointerEvent<HTMLDivElement>) => {
  const target = hotListRef.current;

  if (target?.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  dragRef.current.isDown = false;
};

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logoutCurrentUser();
      setUser(null);
      setJobs((current) => ({
        ...current,
        recommendedJobs: [],
        recommendationTypeName: null,
        bookmarkCount: 0,
      }));
      setIsMenuOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

const ignoreClickAfterDrag = (
  event: MouseEvent<HTMLAnchorElement>,
) => {
  if (!draggedRef.current) return;

  event.preventDefault();
  event.stopPropagation();

  // 드래그 직후 발생하는 클릭만 차단
  draggedRef.current = false;
};

  return (
    <main className={styles.page}>
      <section className={styles.mobileFrame} aria-label="공부엉이 메인">
        <header className={styles.header}>
          <Link href="/" className={styles.logoLink} aria-label="공부엉이 홈">
            <Image src="/tickets/main-logo.png" alt="공부엉이" width={59} height={26} priority />
          </Link>
          <div className={styles.headerActions}>
            {user ? <AppTicketStatus ticketCount={user.creditBalance ?? 0} /> : null}
            {/*
            {user ? (
              <Link href="/notifications" aria-label="알림" className={styles.iconButton}>
                <BellIcon />
                {user.unreadNotificationCount ? (
                  <span className={styles.notificationBadge}>
                    {formatBadgeCount(user.unreadNotificationCount)}
                  </span>
                ) : null}
              </Link>
            ) : null}
            */}
            <button
              type="button"
              aria-label="메뉴 열기"
              className={styles.menuButton}
              onClick={() => setIsMenuOpen(true)}
            >
              <MenuIcon />
            </button>
          </div>
        </header>

        <Link href="/jobs" className={styles.searchBar} aria-label="공고 검색">
          <span>{user ? "공고명, 기업명을 검색하세요." : "공공·기관 검색"}</span>
          <SearchIcon />
        </Link>

        {user ? (
          <Link
            href="/ai-tools/diagnosis/result"
            className={`${resultBannerClassName} ${styles.resultBannerLink}`}
            aria-label={`${diagnosisTypeName} 진단 결과 자세히 보기`}
          >
            <p className={styles.resultEyebrow}>
              {nickname}님의 진단 결과
            </p>
            <strong>{diagnosisTypeName}</strong>
            <span className={styles.resultLink}>
              <span>결과 자세히 보기</span>
              <b aria-hidden="true">→</b>
            </span>
            <Image
              src={resultCard.image}
              alt=""
              width={240}
              height={190}
              className={`${styles.resultOwl} ${resultCard.className}`}
              priority
              sizes="(max-width: 599px) 52vw, 312px"
            />
          </Link>
        ) : (
          <section className={resultBannerClassName}>
            <p className={styles.resultLoginMessage}>
              강점·성향 진단을
              <br />
              진행해 주세요.
            </p>
            <Link href="/login" className={styles.resultLink}>
              <span>진단하러 가기</span>
              <b aria-hidden="true">→</b>
            </Link>
            <Image
              src="/home/home-hero-diagnosis-required.png"
              alt=""
              width={133}
              height={130}
              className={styles.loggedOutResultOwl}
              priority
              sizes="133px"
            />
          </section>
        )}

        <SectionHeader title="🔥 Hot 공고" />
        <div
          ref={hotListRef}
          className={styles.hotList}
          onPointerDown={startHotDrag}
          onPointerMove={moveHotDrag}
          onPointerUp={endHotDrag}
          onPointerCancel={endHotDrag}
          onPointerLeave={endHotDrag}
        >
        {jobs.hotJobs.map((job) => (
          <Link
            href={`/jobs/${job.id}`}
            key={job.id}
            className={styles.hotCard}
            onClickCapture={ignoreClickAfterDrag}
          >
            <span className={`${styles.hotBadge} ${isUrgentDday(job.dday) ? styles.hotBadgeUrgent : ""}`}>
              {job.dday}
            </span>
            <strong>{job.title}</strong>
            <small>{toJobMeta(job)}</small>
          </Link>
        ))}
        </div>

        <SectionHeader title="Ai 취업 도구" href={user ? "#" : "/login"} />
        <div className={styles.toolList}>
          {aiTools.map((tool) => {
            const content = (
              <>
              <span className={styles.toolCopy}>
                <em>{user ? tool.memberTag : tool.tag}</em>
                <strong>{tool.title}</strong>
                <small>{tool.description}</small>
              </span>
              <span className={styles.toolThumb}>
                <Image
                  src={tool.image}
                  alt={tool.imageAlt}
                  width={94}
                  height={80}
                  sizes="94px"
                />
              </span>
              </>
            );

            if (tool.comingSoon) {
              return (
                <button
                  type="button"
                  key={tool.title}
                  className={styles.toolCard}
                  onClick={() => setIsComingSoonOpen(true)}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                href={
                  user
                    ? tool.href
                    : "/login"
                }
                key={tool.title}
                className={styles.toolCard}
              >
                {content}
              </Link>
            );
          })}
        </div>

        <div className={styles.contentBand}>
          <SectionHeader
            title={user ? "진단결과 추천 공고" : "강점·성향 진단결과 추천 공고"}
            href={user ? "/jobs?view=recommended" : "/login"}
          />
          <div className={styles.listGroup}>
            {jobs.recommendedJobs.slice(0, 5).map((job) => (
              <Link
                href={`/jobs/${job.id}`}
                key={job.id}
                className={styles.listItem}
              >
                <small className={styles.company}>{job.institutionName}</small>
                <strong>{job.title}</strong>
                <span className={styles.recommendTags}>
                  {job.employmentType ? <small>{job.employmentType}</small> : null}
                  {job.region ? <small>{formatRegionLabel(job.region)}</small> : null}
                  {job.careerRequirement ? <small>{job.careerRequirement}</small> : null}
                </span>
                <span className={styles.recommendFooter}>
                  <small className={styles.recommendDate}>{toEndDate(job.applicationEndAt)}</small>
                  <span className={`${styles.recommendDday} ${isUrgentDday(job.dday) ? styles.recommendDdayUrgent : ""}`}>
                    {job.dday}
                  </span>
                </span>
                <span className={styles.recommendStar} aria-hidden="true">
                  <Image src="/calendar/star-outline.svg" alt="" width={25} height={25} />
                </span>
              </Link>
            ))}
            {user && jobs.recommendedJobs.length === 0 ? (
              <p className={styles.emptyJobs}>추천 가능한 진행 중 공고가 없습니다.</p>
            ) : null}
            {!user ? (
              <div className={styles.loggedOutRecommendation}>
                <p>
                  진단결과 추천 공고는 로그인 후,
                  <br />
                  강점·성향 진단 테스트를 진행하면 나옵니다.
                </p>
                <Link href="/login">
                  강점·성향 진단 테스트 하기 <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.communityBand}>
          <SectionHeader title="커뮤니티" href={user ? "/community" : "/login"} />
          <div className={styles.listGroup}>
            {communityPreview.map((post) => (
              <Link
                href={user ? `/community/${post.id}` : "/login"}
                key={post.id}
                className={styles.communityItem}
              >
                <span className={styles.communityCategory}>{post.category}</span>
                <strong>{post.title}</strong>
                <span className={styles.communityAuthor}>
                  {post.author.nickname}
                  {post.author.diagnosisTypeName ? (
                    <b className={styles.communityType}>{post.author.diagnosisTypeName}</b>
                  ) : null}
                </span>
                <span className={styles.communityMeta}>
                  <span>조회수 : {post.viewCount.toLocaleString("ko-KR")}</span>
                  <span>추천수 : {post.recommendCount.toLocaleString("ko-KR")}</span>
                  <span>댓글 : {post.commentCount.toLocaleString("ko-KR")}</span>
                  <time>{formatCommunityTime(post.createdAt)}</time>
                </span>
              </Link>
            ))}
            {!communityPreview.length ? (
              <p className={styles.emptyJobs}>등록된 커뮤니티 글이 없습니다.</p>
            ) : null}
          </div>
        </div>

        <BusinessInfo />

        <AppFooter active="home" />

        {isMenuOpen ? (
          <HomeMenuDrawer
            user={user}
            bookmarkCount={jobs.bookmarkCount ?? 0}
            isLoggingOut={isLoggingOut}
            onClose={closeMenu}
            onLogout={handleLogout}
          />
        ) : null}

        {isComingSoonOpen ? (
          <ComingSoonAlert onClose={() => setIsComingSoonOpen(false)} />
        ) : null}
        {ticketRewardMessage ? (
          <TicketRewardAlert
            message={ticketRewardMessage}
            onClose={() => setTicketRewardMessage("")}
          />
        ) : null}
      </section>
    </main>
  );
}

export function HomeMenuDrawer({
  user,
  bookmarkCount = 0,
  isLoggingOut = false,
  onClose,
  onLogout,
}: {
  user: CurrentUserDto | null;
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

    // Keep the desktop scrollbar gutter while the page is locked so the
    // centered 600px frame does not shift when the drawer opens.
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
            className={styles.drawerAvatar}
            style={user ? { backgroundColor: profileBackgroundColor } : undefined}
            aria-hidden="true"
          >
            {user ? (
              <Image src={profileAvatarSrc} alt="" width={64} height={64} unoptimized />
            ) : (
              <span>☺️</span>
            )}
          </div>
          <div>
            <strong>{user ? profileNickname : "로그인을 해주세요."}</strong>
            {user ? (
              <p>{profileStatusMessage}</p>
            ) : (
              <Link href="/login" className={styles.drawerLoginLink} onClick={onClose}>
                로그인 하기 →
              </Link>
            )}
          </div>
          <button type="button" className={styles.drawerClose} aria-label="메뉴 닫기" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5.4 5.4 18.6 18.6M18.6 5.4 5.4 18.6" />
            </svg>
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
              user ? "/jobs?view=recommended" : "/login",
              user ? "/jobs?view=bookmarked" : "/login",
            ]}
            badge={String(bookmarkCount)}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="calendar"
            title="캘린더"
            items={["전체 채용 캘린더", "나만의 캘린더"]}
            hrefs={user ? ["/calendar", "/calendar?view=mine"] : ["/login", "/login"]}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="ai"
            title="AI 도구"
            label="BEST"
            items={[
              // "AI 도구 모음",
              "직무 성향 진단",
              "AI 자소서 코칭",
              // "AI 면접 코칭",
              // "심리·직무 테스트 모음",
            ]}
            hrefs={user ? [
              // "#",
              "/ai-tools/diagnosis",
              "/ai-tools/coaching",
              // "#",
              // "#",
            ] : [
              // "/login",
              "/login",
              "/login",
              // "/login",
              // "/login",
            ]}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="community"
            title="커뮤니티"
            items={[
              // "인기글",
              // "내 또래 인기글",
              "내 글 · 댓글",
            ]}
            hrefs={user ? [
              // "/community?sort=popular",
              // "/community?sort=popular",
              "/community/activity",
            ] : [
              // "/login",
              // "/login",
              "/login",
            ]}
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

function toJobMeta(job: JobPostingDto) {
  return [job.employmentType, formatRegionLabel(job.region)].filter(Boolean).join(" · ") || job.institutionName;
}

function isUrgentDday(dday: string) {
  const normalized = dday.trim();
  return normalized === "D-Day" || normalized === "D-0" || normalized === "D-1";
}

function toEndDate(value: string | null) {
  if (!value) return "상시 채용";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "상시 채용";

  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `~ ${year}. ${month}. ${day}(${weekday})`;
}

function formatCommunityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < day * 7) return `${Math.floor(diff / day)}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function splitDelimitedOption(value: string | null | undefined) {
  if (!value) return [];

  return value
    .split(/[,.\/·|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatRegionLabel(value: string | null | undefined) {
  const regions = splitDelimitedOption(value);
  if (regions.length <= 3) return regions.join(" · ") || "";

  return `${regions.slice(0, 3).join(" · ")} 외 ${regions.length - 3}개`;
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
      <div className={styles.drawerSectionBody}>
        <h3>
          {titleHref ? <Link href={titleHref} onClick={onNavigate}>{title}</Link> : title}
          {label ? <span className={styles.drawerLabel}>{label}</span> : null}
        </h3>
        {items.length > 0 ? (
          <ul>
            {items.map((item, index) => (
              <li key={item}>
                <Link href={hrefs[index] || "#"} onClick={onNavigate}>
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
  if (icon === "home") {
    return (
      <svg viewBox="0 0 23.013 23.405" aria-hidden="true">
        <path d="M4.039 8.284h14.943c1.18 0 2.136.932 2.136 2.083v10.945c0 1.154-.961 2.093-2.144 2.093H4.039c-1.183 0-2.146-.939-2.146-2.093V10.375c0-1.154.963-2.091 2.146-2.091Z" fill="#2f7ff0" />
        <path d="M11.508 0 0 10.603h23.013L11.508 0Z" fill="#2f7ff0" />
        <path d="M8.786 14.06h5.441c.51 0 .927.404.927.904v8.441H7.861v-8.441c0-.498.414-.904.925-.904Z" fill="#fff" />
      </svg>
    );
  }

  if (icon === "megaphone") {
    return (
      <svg viewBox="0 0 25 24" aria-hidden="true">
        <path d="M14.588 21.898H8.893c-.864 0-1.566.697-1.566 1.556s.702 1.557 1.566 1.557h5.695c.864 0 1.566-.698 1.566-1.557s-.702-1.556-1.566-1.556Z" fill="#62b2f7" />
        <path d="M17.123 6.653a1.925 1.925 0 1 0 0 3.85 1.925 1.925 0 0 0 0-3.85Z" fill="#ff5c5c" />
        <path d="M12.605 1.998c-2.15 3.553-6.188 5.069-7.724 5.564l-1.706.469c-2.293.63-3.646 3.024-3.024 5.345.623 2.321 2.988 3.691 5.28 3.061l1.706-.469c1.539-.378 5.782-1.138 9.412.826.312.211.696.287 1.074.183.895-.245 1.423-1.18 1.178-2.084L15.472 2.496c-.242-.907-1.166-1.441-2.059-1.193-.378.104-.669.364-.808.695Z" fill="#2f7ff0" />
        <path d="M21.222 8.418a.66.66 0 0 0-.664.657v2.256a.664.664 0 0 0 1.328 0V9.075a.66.66 0 0 0-.664-.657Zm-1.125-2.41a.66.66 0 0 0-.658.662v2.275a.658.658 0 1 0 1.316 0V6.67a.66.66 0 0 0-.658-.662Zm4.066 5.396a.66.66 0 0 0-.662.658v2.919a.662.662 0 0 0 1.324 0v-2.919a.66.66 0 0 0-.662-.658Z" fill="#2f7ff0" />
      </svg>
    );
  }

  if (icon === "calendar") {
    return (
      <svg viewBox="0 0 24.001 26.423" aria-hidden="true">
        <path d="M2.573 8.358h23.699v15.466c0 1.35-1.086 2.45-2.419 2.45H4.995c-1.333 0-2.419-1.1-2.419-2.45V8.358Z" fill="#fff" transform="translate(-2.419)" />
        <path d="M0 8.202h24.001v15.619c0 1.439-1.149 2.602-2.57 2.602H2.57C1.152 26.423 0 25.259 0 23.82V8.202Zm.305.306V23.82c0 1.265 1.016 2.297 2.268 2.297h18.858c1.249 0 2.268-1.029 2.268-2.297V8.508H.305Z" fill="#e3ece1" />
        <path d="M2.628 2.17h18.746c1.451 0 2.627 1.191 2.627 2.66v3.683H0V4.83c0-1.469 1.176-2.66 2.628-2.66Z" fill="#2f7ff0" />
        <path d="M6.187 0h.003c.472 0 .856.388.856.866v2.606c0 .478-.384.866-.856.866h-.003c-.473 0-.859-.388-.859-.866V.866C5.328.388 5.714 0 6.187 0Zm12.03 0h.003c.472 0 .856.388.856.866v2.606c0 .478-.384.866-.856.866h-.003c-.473 0-.859-.388-.859-.866V.866c0-.478.386-.866.859-.866Z" fill="#155abc" />
        <path d="M4.542 11.912h2.913c.237 0 .429.195.429.435v2.948c0 .24-.192.435-.429.435H4.542a.432.432 0 0 1-.429-.435v-2.948c0-.24.192-.435.429-.435Zm0 5.728h2.913c.237 0 .429.195.429.435v2.948c0 .24-.192.435-.429.435H4.542a.432.432 0 0 1-.429-.435v-2.948c0-.24.192-.435.429-.435Zm5.658-5.728h2.913c.237 0 .429.195.429.435v2.948c0 .24-.192.435-.429.435H10.2a.432.432 0 0 1-.429-.435v-2.948c0-.24.192-.435.429-.435Z" fill="#e6e7e5" />
        <path d="m19.916 21.158-.696.689a38.64 38.64 0 0 1-1.863 1.653 41.84 41.84 0 0 1-1.887-1.675c-.217-.202-.42-.401-.626-.615-.372-.392-.683-.814-.828-1.335-.145-.52-.082-1.096.187-1.577.527-.936 1.7-1.273 2.61-.694.215.137.39.309.541.517.533-.744 1.464-1.013 2.283-.634.524.242.908.71 1.062 1.271.115.413.097.842-.042 1.246-.149.441-.421.808-.741 1.154Z" fill="#ff5c5c" />
      </svg>
    );
  }

  if (icon === "ai") {
    return (
      <svg viewBox="0 0 26.134 26.322" aria-hidden="true">
        <path d="M1.963 12.235h22.209c1.084 0 1.962.89 1.962 1.987v3.994c0 1.097-.878 1.986-1.962 1.986H1.963A1.975 1.975 0 0 1 0 18.216v-3.994c0-1.097.879-1.987 1.963-1.987Z" fill="#2f7ff0" />
        <path d="M12.914 2.876h.31v4.548h-.31V2.876Z" fill="#fff" />
        <path d="M12.634 2.593h.869v5.114h-.869V2.593Z" fill="#c0d1e3" />
        <path d="M11.018 6.399h4.101c5.351 0 9.701 4.407 9.701 9.821 0 5.415-4.35 9.822-9.701 9.822h-4.101c-5.348 0-9.701-4.407-9.701-9.822 0-5.414 4.35-9.821 9.701-9.821Z" fill="#fff" />
        <path d="M11.018 6.113h4.101c5.51 0 9.981 4.523 9.981 10.104 0 5.579-4.468 10.105-9.981 10.105h-4.101c-5.511 0-9.981-4.523-9.981-10.105 0-5.578 4.468-10.104 9.981-10.104Zm0 .566c-5.195 0-9.422 4.28-9.422 9.538 0 5.259 4.227 9.539 9.422 9.539h4.101c5.194 0 9.421-4.28 9.421-9.539 0-5.258-4.227-9.538-9.421-9.538h-4.101Z" fill="#c0d1e3" />
        <path d="M10.526 9.722h5.085c3.545 0 6.419 2.909 6.419 6.498v.003c0 3.589-2.874 6.499-6.419 6.499h-5.085c-3.545 0-6.419-2.91-6.419-6.499v-.003c0-3.589 2.874-6.498 6.419-6.498Z" fill="#2f7ff0" />
        <circle cx="13.067" cy="2.007" r="1.982" fill="#fec440" />
        <ellipse cx="9.019" cy="15.34" rx=".953" ry="1.574" fill="#fff" />
        <ellipse cx="17.115" cy="15.34" rx=".953" ry="1.574" fill="#fff" />
        <path d="M11.669 17.483c0 .916.735 1.665 1.648 1.665.912 0 1.648-.749 1.648-1.665" fill="none" stroke="#fff" strokeWidth=".5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "community") {
    return (
      <svg viewBox="0 0 26 22.86" aria-hidden="true">
        <path d="M15.283 3.214c-.533.453-1.05.905-1.567 1.381-.541-.459-1.063-.92-1.577-1.4-.18-.169-.352-.335-.522-.515-.311-.326-.572-.68-.691-1.116-.12-.435-.07-.916.155-1.318.442-.781 1.422-1.065 2.183-.582.18.115.327.259.452.433.447-.621 1.225-.849 1.908-.528.436.202.758.593.888 1.062.095.346.081.706-.036 1.043-.125.368-.35.675-.619.967l-.584.573Z" fill="#ff5c5c" />
        <circle cx="4.929" cy="11.445" r="2.36" fill="#75d49f" />
        <circle cx="21.361" cy="11.445" r="2.36" fill="#fec440" />
        <path d="M.389 22.86A5.985 5.985 0 0 1 0 20.76c0-3.075 2.463-5.571 5.503-5.571 3.041 0 5.503 2.493 5.503 5.571 0 .742-.144 1.451-.402 2.1H.389Zm14.994 0a5.985 5.985 0 0 1-.389-2.1c0-3.075 2.463-5.571 5.503-5.571 3.041 0 5.503 2.493 5.503 5.571 0 .742-.144 1.451-.402 2.1H15.383Z" fill="#75d49f" />
        <path d="M15.383 22.86a5.985 5.985 0 0 1-.389-2.1c0-3.075 2.463-5.571 5.503-5.571 3.041 0 5.503 2.493 5.503 5.571 0 .742-.144 1.451-.402 2.1H15.383Z" fill="#fec440" />
        <circle cx="13.144" cy="9.445" r="2.754" fill="#62b2f7" />
        <path d="M6.988 22.86a6.975 6.975 0 0 1-.466-2.527c0-3.702 2.965-6.704 6.622-6.704s6.622 3.002 6.622 6.704c0 .894-.172 1.746-.486 2.527H6.988Z" fill="#62b2f7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 20.798" aria-hidden="true">
      <circle cx="8.614" cy="4.517" r="4.501" fill="#2f7ff0" />
      <path d="M11.404 15.153c0-1.21.704-2.89 1.352-3.81-.835-.551-2.281-1.14-4.145-1.14C3.856 10.203 0 14.306 0 19.365h13.294c-1.157-1.035-1.89-2.535-1.89-4.212Z" fill="#2f7ff0" />
      <path d="M18.374 9.508c-1.899 0-3.575.947-4.595 2.395a5.607 5.607 0 0 0-1.031 3.25c0 1.676.733 3.177 1.89 4.212.993.888 2.299 1.29 3.736 1.29A5.635 5.635 0 0 0 24 15.01a5.635 5.635 0 0 0-5.626-5.502Z" fill="#fec440" />
      <path d="m21.795 14.212-1.849 1.348a.174.174 0 0 0-.065.194l.707 2.18c.053.162-.131.293-.266.194l-1.849-1.348a.176.176 0 0 0-.204 0l-1.846 1.345c-.135.1-.319-.035-.266-.194l.707-2.177a.174.174 0 0 0-.064-.194l-1.849-1.348c-.135-.1-.068-.313.102-.313h2.284c.076 0 .14-.05.164-.121l.707-2.18c.052-.161.277-.161.33 0l.707 2.18c.023.071.09.121.163.121h2.284c.167 0 .237.216.103.313Z" fill="#fff" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="317 13 22 22" aria-hidden="true">
      <path
        d="M338.451 29.2357H338.47L338.284 29.0485C338.191 28.9548 338.089 28.8681 337.982 28.7906L335.303 26.8631V22.1867C335.303 22.1276 335.302 22.0738 335.301 22.0222C335.3 21.9796 335.298 21.933 335.296 21.8805C335.296 21.8745 335.296 21.8679 335.295 21.8618C335.26 21.0601 335.095 20.2748 334.804 19.5293C334.799 19.5144 334.792 19.5004 334.785 19.4862C334.493 18.7508 334.087 18.0729 333.578 17.471C332.712 16.4465 331.584 15.6807 330.314 15.2557C330.31 15.254 330.307 15.2527 330.303 15.2516C330.282 15.2447 330.261 15.2381 330.24 15.2315C330.229 15.228 330.217 15.2244 330.206 15.2205L330.167 15.2082C330.14 15.1997 330.111 15.1912 330.074 15.1804C330.049 15.1728 330.023 15.1653 329.997 15.1579L329.962 15.148L329.926 15.1382C329.89 15.1283 329.853 15.1184 329.815 15.1088L329.793 15.103L329.77 15.0973C329.747 15.0912 329.719 15.0846 329.69 15.0775V14.6895C329.69 14.2839 329.543 13.8913 329.277 13.5843C329.014 13.2806 328.652 13.0799 328.258 13.0195C328.175 13.0066 328.088 13 328.001 13C327.914 13 327.829 13.0066 327.744 13.0192C327.35 13.0799 326.987 13.2803 326.724 13.5843C326.458 13.8913 326.312 14.2837 326.312 14.6895V15.0775C326.285 15.0838 326.259 15.0904 326.232 15.097C326.216 15.1011 326.201 15.1049 326.186 15.1088C326.148 15.1184 326.111 15.1283 326.076 15.1379C326.051 15.1445 326.027 15.1513 326.004 15.1579C325.986 15.1629 325.969 15.1678 325.952 15.173L325.927 15.1804C325.896 15.1892 325.867 15.1983 325.837 15.2074H325.836L325.834 15.2082L325.795 15.2205L325.784 15.2241C325.755 15.2332 325.727 15.2422 325.698 15.2518C325.694 15.2529 325.69 15.2543 325.687 15.256C324.417 15.6813 323.289 16.4471 322.423 17.4713C321.914 18.0729 321.508 18.7508 321.216 19.4864C321.208 19.5021 321.201 19.5164 321.196 19.5304C320.906 20.2753 320.74 21.0606 320.706 21.8638V21.8687C320.706 21.8717 320.706 21.8747 320.705 21.8778V21.8794C320.703 21.9338 320.701 21.9796 320.701 22.0233C320.699 22.0895 320.699 22.14 320.699 22.1875V26.8639L318.02 28.7912C317.912 28.8689 317.81 28.9562 317.716 29.0504C317.261 29.5073 317 30.1385 317 30.7822V31.4016C317 31.8676 317.379 32.2468 317.845 32.2468H324.801C325.038 33.8231 326.396 35 328 35C329.604 35 330.962 33.8231 331.199 32.2468H338.155C338.621 32.2468 339 31.8676 339 31.4016V30.7822C339 30.222 338.802 29.6712 338.451 29.2365L338.451 29.2357ZM330.215 32.246C329.99 33.2712 329.06 34.0294 328.001 34.0294H328.001C326.941 34.0294 326.012 33.2712 325.787 32.246H330.215ZM328.728 15.5585C328.764 15.7562 328.921 15.9136 329.12 15.949C329.145 15.9537 329.171 15.9586 329.197 15.9633C329.21 15.9658 329.223 15.9682 329.236 15.9707C329.247 15.9729 329.259 15.9754 329.271 15.9778C329.283 15.9803 329.296 15.9831 329.308 15.9855C329.322 15.9885 329.336 15.9916 329.351 15.9946L329.359 15.9962C329.381 16.0012 329.403 16.0061 329.425 16.0113C329.446 16.016 329.466 16.0209 329.486 16.0256C329.505 16.0303 329.524 16.0347 329.543 16.0396C329.572 16.0468 329.6 16.0542 329.628 16.0619H329.629L329.63 16.0624C329.64 16.0649 329.649 16.0673 329.659 16.0704C330.903 16.4087 332.002 17.1094 332.837 18.0973C333.735 19.1597 334.264 20.5117 334.326 21.9044C334.326 21.9088 334.326 21.9129 334.327 21.9173C334.329 21.956 334.33 21.9967 334.331 22.045C334.332 22.0928 334.333 22.1392 334.333 22.1872V27.1121C334.333 27.2675 334.408 27.4147 334.534 27.5056L337.415 29.5781C337.494 29.6352 337.57 29.7025 337.639 29.7775C337.892 30.0531 338.031 30.4098 338.031 30.7816V31.2761H317.969V30.7811C317.969 30.4101 318.108 30.054 318.36 29.7788C318.43 29.7022 318.506 29.6347 318.586 29.5778L321.466 27.5053C321.593 27.4144 321.668 27.2672 321.668 27.1116V22.1867C321.668 22.1394 321.668 22.0914 321.67 22.0442C321.671 21.9958 321.672 21.9533 321.674 21.9148V21.906C321.736 20.5123 322.265 19.1594 323.163 18.0968C323.998 17.1088 325.097 16.4078 326.34 16.0701C326.349 16.0676 326.36 16.0649 326.371 16.0621C326.4 16.0544 326.429 16.0468 326.458 16.0393C326.477 16.0344 326.496 16.03 326.515 16.0253C326.535 16.0204 326.555 16.0157 326.575 16.0111C326.598 16.0058 326.62 16.0006 326.642 15.996C326.651 15.994 326.659 15.9921 326.668 15.9905C326.677 15.9885 326.686 15.9866 326.695 15.9847C326.718 15.9798 326.741 15.9748 326.765 15.9701L326.804 15.9627C326.83 15.9578 326.856 15.9528 326.882 15.9482C327.08 15.9125 327.237 15.7554 327.273 15.5569C327.278 15.5278 327.281 15.499 327.281 15.4707V14.6884C327.281 14.2914 327.603 13.9684 328 13.9684C328.397 13.9684 328.72 14.2914 328.72 14.6884V15.4707C328.72 15.5006 328.723 15.53 328.728 15.558V15.5585H328.728Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg width="22" height="15" viewBox="355 17 22 15" aria-hidden="true">
      <path d="M377 17H355V18.1H377V17Z" fill="currentColor" />
      <path d="M377 23.9217H355V25.0217H377V23.9217Z" fill="currentColor" />
      <path d="M377 30.8437H355V31.9437H377V30.8437Z" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M12.8 20.1a7.3 7.3 0 1 0 0-14.6 7.3 7.3 0 0 0 0 14.6ZM18.4 18.4l4.4 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BusinessInfo() {
  return (
    <section className={styles.businessInfo} aria-label="사업자 정보">
      <h2>(주)커리어넷 사업자 정보</h2>
      <dl>
        <dt>대표이사</dt>
        <dd>박윤수</dd>

        <dt>주소</dt>
        <dd>
          <address>
            (주)커리어넷, (08381)서울특별시 구로구 디지털로 273,
            <br />
            2층(구로동, 에이스트윈타워 2차)
          </address>
        </dd>

        <dt>문의전화</dt>
        <dd>1577-9577 (평일 09:00~18:00 [주말, 공휴일 휴무])</dd>

        <dt>이메일</dt>
        <dd>helpdesk@career.co.kr</dd>

        <dt>사업자등록번호</dt>
        <dd>220-86-73547</dd>

        <dt>통신판매업 신고번호</dt>
        <dd>2010-서울구로-0401</dd>
      </dl>
    </section>
  );
}

function SectionHeader({ icon, title, href }: { icon?: string; title: string; href?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {title}
      </h2>
      {href ? <Link href={href}>전체 보기 &gt;</Link> : null}
    </div>
  );
}
