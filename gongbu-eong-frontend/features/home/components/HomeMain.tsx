"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent, PointerEvent } from "react";
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
    title: "강점·성향 진단",
    description: "16문항이면 끝, 내 강점 유형을 알려드려요.",
    image: "/home/home-tool-match.png",
    imageAlt: "강점·성향 진단",
  },
  {
    href: "#",
    tag: "첫 1회 무료",
    title: "Ai 자소서 코칭",
    description: "합격하는 문장으로 AI가 다듬어 드려요.",
    image: "/home/home-tool-diagnosis.png",
    imageAlt: "Ai 자소서 코칭",
  },
  {
    href: "#",
    tag: "첫 1회 무료",
    title: "Ai 면접 코칭",
    description: "실전처럼 연습하고 면접 울렁증 극복해요.",
    image: "/home/home-tool-resume.png",
    imageAlt: "Ai 면접 코칭",
  },
  {
    href: "#",
    tag: "준비중",
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

const communityPosts = [
  {
    id: "post-1",
    category: "후기",
    title: "○○공사 필기 난이도 정리해봤어요",
    description: "문제 유형이 작년이랑 좀 달라졌어요. 자료해석 파트가 특…",
  },
  {
    id: "post-2",
    category: "합격",
    title: "안정형인데 이 기관 붙었습니다 🎉",
    description: "진단에서 나온 유형 그대로 지원했더니 잘 맞더라고요.",
  },
  {
    id: "post-3",
    category: "질문",
    title: "NCS 직업기초 어디서 공부하나요?",
    description: "독학 중인데 추천 자료나 강의 있을까요?",
  },
];

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [jobs, setJobs] = useState<HomeJobsResponseDto>({
    hotJobs: [],
    recommendedJobs: [],
    recommendationTypeName: null,
    bookmarkCount: 0,
  });
  const hotListRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const draggedRef = useRef(false);

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
            <span className={styles.logoAccent}>공</span>부엉이
          </Link>
          <div className={styles.headerActions}>
            {user ? (
              <Link href="#" aria-label="알림" className={styles.iconButton}>
                <BellIcon />
              </Link>
            ) : null}
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

        <Link href="#" className={styles.searchBar} aria-label="공고 검색">
          <span>공공·기관 검색</span>
          <SearchIcon />
        </Link>

          <section
            className={`${styles.resultBanner} ${
              user ? resultCard.bannerClassName : styles.loggedOutResultBanner
            }`}
          >
            {user ? (
              <>
                <p className={styles.resultEyebrow}>
                  {nickname}님의 진단 결과
                </p>
                <strong>{diagnosisTypeName}</strong>
              </>
            ) : (
              <p className={styles.resultLoginMessage}>
                강점·성향 진단을
                <br />
                진행해 주세요.
              </p>
            )}
            <Link
              href={user ? "/ai-tools/diagnosis/result" : "/ai-tools/diagnosis"}
              className={styles.resultLink}
            >
              <span>{user ? "결과 자세히 보기" : "진단하러 가기"}</span>
              <b aria-hidden="true">→</b>
            </Link>
            {user ? (
              <Image
                src={resultCard.image}
                alt=""
                width={240}
                height={190}
                className={`${styles.resultOwl} ${resultCard.className}`}
                priority
                sizes="(max-width: 599px) 52vw, 312px"
              />
            ) : (
              <Image
                src="/home/home-login-required-owl.png"
                alt=""
                width={133}
                height={130}
                className={styles.loggedOutResultOwl}
                priority
                sizes="133px"
              />
            )}
          </section>

        <SectionHrefNoneHeader icon="🔥" title="Hot 공고" />
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

        <SectionHeader title="AI 취업 도구" href={user ? "#" : "/login"} />
        <div className={styles.toolList}>
          {aiTools.map((tool) => {
            const content = (
              <>
              <span className={styles.toolCopy}>
                <em>{tool.tag}</em>
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
                  tool.href === "/ai-tools/diagnosis"
                    ? tool.href
                    : user
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
            title="진단결과 추천 공고"
            href={user ? "/jobs?view=recommended" : "/login"}
          />
          <div className={styles.listGroup}>
            {jobs.recommendedJobs.slice(0, 5).map((job) => (
              <Link
                href={`/jobs/${job.id}`}
                key={job.id}
                className={styles.listItem}
              >
                <span className={styles.recommendTop}>
                  <small className={styles.company}>{job.institutionName}</small>
                  <span className={`${styles.recommendDday} ${isUrgentDday(job.dday) ? styles.recommendDdayUrgent : ""}`}>
                    {job.dday}
                  </span>
                </span>
                <strong>{job.title}</strong>
                <span className={styles.recommendTags}>
                  {job.employmentType ? <small>{job.employmentType}</small> : null}
                  {job.region ? <small>{job.region}</small> : null}
                  {job.careerRequirement ? <small>{job.careerRequirement}</small> : null}
                </span>
                <small className={styles.recommendDate}>{toEndDate(job.applicationEndAt)}</small>
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
                <Link href="/ai-tools/diagnosis">
                  강점·성향 진단 테스트 하기 <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : null}
          </div>

          <SectionHeader title="커뮤니티" href={user ? "#" : "/login"} />
          <div className={styles.listGroup}>
            {communityPosts.map((post) => (
              <Link
                href={user ? "#" : "/login"}
                key={post.id}
                className={styles.communityItem}
              >
                <span className={styles.communityCategory}>{post.category}</span>
                <strong>{post.title}</strong>
                <p>{post.description}</p>
                <span className={styles.communityMeta}>
                  <span>♡ 1,204</span>
                  <span>♧ 32</span>
                  <time>2시간 전</time>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <footer className={styles.footerNav} aria-label="하단 메뉴">
          <Link href="/" className={styles.footerActive}>
            <HomeIcon />
            <span>홈</span>
          </Link>
          <Link href={user ? "/calendar" : "/login"}>
            <CalendarIcon />
            <span>캘린더</span>
          </Link>
          <Link href={user ? "/ai-tools/diagnosis" : "/login"}>
            <span className={styles.footerAiIcon}>
              <AiIcon />
              <small>BEST</small>
            </span>
            <span>AI 도구</span>
          </Link>
          <Link href={user ? "#" : "/login"}>
            <CommunityIcon />
            <span>커뮤니티</span>
          </Link>
          <Link href={user ? "/my" : "/login"}>
            <MyIcon />
            <span>MY</span>
          </Link>
        </footer>

        {isMenuOpen ? (
          <HomeMenuDrawer
            user={user}
            nickname={nickname}
            bookmarkCount={jobs.bookmarkCount ?? 0}
            isLoggingOut={isLoggingOut}
            onClose={closeMenu}
            onLogout={handleLogout}
          />
        ) : null}

        {isComingSoonOpen ? (
          <div className={styles.noticeOverlay} role="presentation">
            <button
              type="button"
              className={styles.noticeDim}
              aria-label="안내 닫기"
              onClick={() => setIsComingSoonOpen(false)}
            />
            <section
              className={styles.noticeDialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="coming-soon-title"
            >
              <span className={styles.noticeIcon} aria-hidden="true">AI</span>
              <h2 id="coming-soon-title">준비중인 메뉴예요</h2>
              <p>탈락사례 분석 메뉴는 준비중 입니다.</p>
              <button type="button" onClick={() => setIsComingSoonOpen(false)}>
                확인
              </button>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export function HomeMenuDrawer({
  user,
  nickname,
  bookmarkCount = 0,
  isLoggingOut = false,
  onClose,
  onLogout,
}: {
  user: CurrentUserDto | null;
  nickname: string;
  bookmarkCount?: number;
  isLoggingOut?: boolean;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const portalRoot = typeof document === "undefined" ? null : document.body;


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
          <div className={styles.drawerAvatar} aria-hidden="true">
            {user?.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" width={64} height={64} />
            ) : (
              <span>{user ? "🙉" : "☺️"}</span>
            )}
          </div>
          <div>
            <strong>{user ? nickname : "로그인을 해주세요."}</strong>
            {user ? (
              <p>프로필을 수정 할 수 있습니다.</p>
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
            items={["AI 도구 모음", "직무 성향 진단", "AI 자소서 코칭", "AI 면접 코칭", "심리·직무 테스트 모음"]}
            hrefs={user ? [] : ["/login", "/login", "/login", "/login", "/login"]}
            onNavigate={onClose}
          />
          <DrawerSection
            icon="community"
            title="커뮤니티"
            items={["인기글", "내 또래 인기글", "내 글 · 댓글"]}
            hrefs={user ? [] : ["/login", "/login", "/login"]}
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
  return [job.employmentType, job.region].filter(Boolean).join(" · ") || job.institutionName;
}

function isUrgentDday(dday: string) {
  const normalized = dday.trim();
  return normalized === "D-Day" || normalized === "D-0" || normalized === "D-1";
}

function toEndDate(value: string | null) {
  if (!value) return "상시 채용";

  return `~ ${new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))}`;
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

function SectionHeader({ icon, title, href }: { icon?: string; title: string; href: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {title}
      </h2>
      <Link href={href}>전체 보기 &gt;</Link>
    </div>
  );
}

function SectionHrefNoneHeader({ icon, title }: { icon?: string; title: string; }) {
  return (
    <div className={styles.sectionHeader}>
      <h2>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {title}
      </h2>
    </div>
  );
}


export function HomeIcon() {
  return (
    <svg viewBox="0 0 24.9305 26" aria-hidden="true">
      <path d="M2.3252 9.2021h16.1773c1.281 0 2.3223 1.0412 2.3223 2.3223v12.1592c0 1.2782-1.0356 2.3138-2.3139 2.3138H2.3139C1.0356 25.9974 0 24.9618 0 23.6836V11.5244c0-1.2811 1.0412-2.3223 2.3223-2.3223h.0029Z" fill="#2F7FF0" transform="translate(2.0515 0)" />
      <path d="M12.4667 0 0 11.7782h24.9305L12.4667 0Z" fill="#2F7FF0" />
      <path d="M1.0017 0h5.8947c.5531 0 1.0046.4487 1.0046 1.0046v10.3814H0V1.0046C0 .4515.4487 0 1.0046 0h-.0029Z" fill="#FFFFFF" transform="translate(8.5162 15.6185)" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24.0014 26.1" aria-hidden="true">
      <path d="M2.4192 17.6963C1.0856 17.6963 0 16.6107 0 15.2771V0h23.699v15.2771c0 1.3336-1.0856 2.4192-2.4192 2.4192H2.4192Z" fill="#FFFFFF" transform="translate(.1542 8.2543)" />
      <path d="M23.699.3024v15.1259c0 1.252-1.0191 2.268-2.268 2.268H2.5734c-1.2519 0-2.268-1.0191-2.268-2.268V.3024H23.699ZM24.0014 0H0v15.4283c0 1.4213 1.1521 2.5704 2.5704 2.5704h18.8575c1.4213 0 2.5704-1.1521 2.5704-2.5704V0h.0031Z" fill="#E3ECE1" transform="translate(0 8.1)" />
      <path d="M2.6278 0h18.7457c1.4515 0 2.6279 1.1763 2.6279 2.6278v3.6379H0V2.6278C0 1.1763 1.1763 0 2.6278 0Z" fill="#2F7FF0" transform="translate(0 2.1439)" />
      <path d="M.8588 0h-.003C.3831 0 0 .3832 0 .8558v2.5734c0 .4726.3831.8558.8558.8558h.003c.4726 0 .8558-.3832.8558-.8558V.8558C1.7146.3832 1.3314 0 .8588 0Z" fill="#155ABC" transform="translate(5.3283)" />
      <path d="M.8588 0h-.003C.3831 0 0 .3832 0 .8558v2.5734c0 .4726.3831.8558.8558.8558h.003c.4726 0 .8558-.3832.8558-.8558V.8558C1.7146.3832 1.3314 0 .8588 0Z" fill="#155ABC" transform="translate(17.3577)" />
      <path d="M3.3415 0H.4294C.1923 0 0 .1923 0 .4294v2.9121c0 .2372.1923.4294.4294.4294h2.9121c.2372 0 .4294-.1922.4294-.4294V.4294C3.7709.1923 3.5787 0 3.3415 0Z" fill="#E6E7E5" transform="translate(4.1126 11.7664)" />
      <path d="M3.3415 0H.4294C.1923 0 0 .1922 0 .4294v2.9121c0 .2371.1923.4294.4294.4294h2.9121c.2372 0 .4294-.1923.4294-.4294V.4294C3.7709.1922 3.5787 0 3.3415 0Z" fill="#E6E7E5" transform="translate(4.1126 17.4241)" />
      <path d="M3.3415 0H.4294C.1923 0 0 .1923 0 .4294v2.9121c0 .2372.1923.4294.4294.4294h2.9121c.2372 0 .4294-.1922.4294-.4294V.4294C3.7709.1923 3.5787 0 3.3415 0Z" fill="#E6E7E5" transform="translate(9.7705 11.7664)" />
      <path d="m5.9757 3.7948-.6956.6804c-.6078.5625-1.2247 1.0977-1.8627 1.633C2.7702 5.5669 2.1473 5.0226 1.5304 4.4541c-.2177-.1996-.4203-.3962-.626-.6079C.5325 3.4592.221 3.0419.0759 2.5278-.0693 2.0137-.0058 1.4452.2633.9704.7895.0451 1.9628-.2875 2.873.284c.2147.1361.3901.3054.5413.511.5323-.7348 1.4636-1.0009 2.2831-.6259.5232.2389.9072.7015 1.0615 1.2549.1149.4083.0967.8316-.0424 1.2308-.1481.4354-.4203.7983-.7408 1.14Z" fill="#FF5C5C" transform="translate(13.9403 17.1038)" />
    </svg>
  );
}

export function AiIcon() {
  return (
    <svg viewBox="0 0 27.0087 26.8701" aria-hidden="true">
      <path d="M24.9804 0H2.0283C.9081 0 0 .9081 0 2.0283V6.105c0 1.1202.9081 2.0283 2.0283 2.0283h22.9521c1.1202 0 2.0283-.9081 2.0283-2.0283V2.0283C27.0087.9081 26.1006 0 24.9804 0Z" fill="#2F7FF0" transform="translate(0 12.4902)" />
      <path d="M.3207 0H0v4.643h.3207V0Z" fill="#FFFFFF" transform="translate(13.344 2.943)" />
      <path d="M.8986 0H0v5.2209h.8986V0Z" fill="#C0D1E3" transform="translate(13.0551 2.6541)" />
      <path d="M10.0257 20.0515C4.4957 20.0515 0 15.5529 0 10.0257 0 4.4986 4.4986 0 10.0257 0h4.2385c5.53 0 10.0257 4.4986 10.0257 10.0257 0 5.5272-4.4986 10.0258-10.0257 10.0258h-4.2385Z" fill="#FFFFFF" transform="translate(1.355 6.5308)" />
      <path d="M14.5531.5779c5.3683 0 9.7368 4.3685 9.7368 9.7368 0 5.3682-4.3685 9.7368-9.7368 9.7368h-4.2385C4.9464 20.0515.5778 15.6829.5778 10.3147.5778 4.9464 4.9464.5779 10.3146.5779h4.2385ZM14.5531 0h-4.2385C4.617 0 0 4.6199 0 10.3147c0 5.6976 4.6199 10.3146 10.3146 10.3146h4.2385c5.6976 0 10.3147-4.6199 10.3147-10.3146C24.8678 4.617 20.2478 0 14.5531 0Z" fill="#C0D1E3" transform="translate(1.066 6.239)" />
      <path d="M11.8893 0H6.6337C2.97 0 0 2.97 0 6.6337v.0029c0 3.6638 2.97 6.6338 6.6337 6.6338h5.2556c3.6637 0 6.6337-2.97 6.6337-6.6338v-.0029C18.523 2.97 15.553 0 11.8893 0Z" fill="#2F7FF0" transform="translate(4.2442 9.9246)" />
      <path d="M2.0485 4.097A2.0485 2.0485 0 1 0 2.0485 0a2.0485 2.0485 0 0 0 0 4.097Z" fill="#FEC440" transform="translate(11.4559)" />
      <path d="M.9852 3.2129c.5442 0 .9853-.7193.9853-1.6065S1.5294 0 .9852 0 0 .7192 0 1.6064s.4411 1.6065.9852 1.6065Z" fill="#FFFFFF" transform="translate(8.3355 14.0532)" />
      <path d="M.9852 3.2129c.5442 0 .9853-.7193.9853-1.6065S1.5294 0 .9852 0 0 .7192 0 1.6064s.4411 1.6065.9852 1.6065Z" fill="#FFFFFF" transform="translate(16.7028 14.0532)" />
      <path d="M2.8892 0c0 .6594-.5352 1.1946-1.4446 1.1946C.7853 1.1946.25.6594.25 0" fill="none" stroke="#FFFFFF" strokeWidth=".5" strokeLinecap="round" transform="translate(12.0598 17.847)" />
    </svg>
  );
}

export function CommunityIcon() {
  return (
    <svg viewBox="0 0 27.6344 24" aria-hidden="true">
      <path d="m5.308 3.3744-.6197.605C4.1483 4.4782 3.5993 4.9533 3.0327 5.4284 2.4572 4.9474 1.9024 4.4634 1.3565 3.9588c-.1918-.1771-.3748-.3512-.5548-.5401C.4711 3.0764.1937 2.7045.0668 2.2471-.0601 1.7897-.0069 1.2851.2321.8631.7013.0426 1.7431-.2554 2.5517.2522c.1918.121.3482.2715.481.4544.4752-.6521 1.3015-.8912 2.0275-.5548.4633.2125.8056.6227.9443 1.1156.1004.3629.0856.7407-.0384 1.0948-.1328.3866-.3718.7083-.6581 1.0152v-.003Z" fill="#FF5C5C" transform="translate(10.9294)" />
      <path d="M2.5085 5.0169A2.5085 2.5085 0 1 0 2.5085 0a2.5085 2.5085 0 0 0 0 5.0169Z" fill="#75D49F" transform="translate(2.7298 9.5067)" />
      <path d="M2.5085 5.0169A2.5085 2.5085 0 1 0 2.5085 0a2.5085 2.5085 0 0 0 0 5.0169Z" fill="#FEC440" transform="translate(20.1946 9.5067)" />
      <path d="M.4132 8.0536C.1476 7.3837 0 6.6134 0 5.8491 0 2.6206 2.6177 0 5.8491 0c3.2315 0 5.8492 2.6176 5.8492 5.8491 0 .7791-.1535 1.5228-.4279 2.2045H.4132Z" fill="#75D49F" transform="translate(0 15.946)" />
      <path d="M.4132 8.0536C.1476 7.3837 0 6.6134 0 5.8491 0 2.6206 2.6177 0 5.8491 0c3.2315 0 5.8492 2.6176 5.8492 5.8491 0 .7791-.1535 1.5228-.4279 2.2045H.4132Z" fill="#FEC440" transform="translate(15.9361 15.946)" />
      <path d="M2.9275 5.855A2.9275 2.9275 0 1 0 2.9275 0a2.9275 2.9275 0 0 0 0 5.855Z" fill="#62B2F7" transform="translate(11.0431 6.9893)" />
      <path d="M.4958 9.6914C.1741 8.8858 0 7.9591 0 7.0384 0 3.1518 3.1518 0 7.0385 0c3.8866 0 7.0384 3.1518 7.0384 7.0384 0 .9384-.183 1.8326-.5164 2.653H.4958Z" fill="#62B2F7" transform="translate(6.9321 14.3085)" />
    </svg>
  );
}

export function MyIcon() {
  return (
    <svg viewBox="0 0 28.3207 24.46" aria-hidden="true">
      <path d="M5.3119 10.6237A5.3119 5.3119 0 1 0 5.3119 0a5.3119 5.3119 0 0 0 0 10.6237Z" fill="#2F7FF0" transform="translate(4.8535)" />
      <path d="M13.4572 5.822c0-1.4236.8307-3.3988 1.5959-4.4811C14.0673.6928 12.361 0 10.1618 0 4.5501 0 0 4.8258 0 10.7753h15.6874c-1.365-1.2167-2.2302-2.9816-2.2302-4.9533Z" fill="#2F7FF0" transform="translate(0 12)" />
      <path d="M6.639 0C4.3984 0 2.4198 1.1134 1.2168 2.8162.4516 3.8986 0 5.2153 0 6.6389c0 1.9717.8652 3.7366 2.2302 4.9534 1.172 1.0444 2.7128 1.6856 4.4088 1.6856 3.6676 0 6.6389-2.9713 6.6389-6.639C13.2779 2.9713 10.3066 0 6.639 0Zm4.0364 5.5325L8.4935 7.1181c-.0724.0517-.1.1448-.0759.2275l.8342 2.5646c.0621.1895-.1551.3447-.3137.2275L6.7562 8.552c-.0724-.0517-.1689-.0517-.2413 0L5.2843 9.4448l-.9479.6894c-.1586.1172-.3758-.0414-.3137-.2275l.748-2.2957.0862-.2654c.0275-.0827 0-.1758-.0759-.2275L4.4708 6.894 2.5991 5.5325c-.1586-.1172-.0793-.3689.1206-.3689h2.6956c.0896 0 .1654-.0586.193-.1413l.8342-2.5646c.062-.1896.3275-.1896.3895 0l.8342 2.5646c.0276.0827.1068.1413.193.1413h2.6956c.1965 0 .2792.2551.1206.3689Z" fill="#FEC440" transform="translate(15.0427 11.182)" />
      <path d="M8.1598 3.2169c.1585-.1172.0792-.3688-.1207-.3688H5.3436c-.0897 0-.1655-.0586-.1931-.1413L4.3163.1422c-.062-.1896-.3274-.1896-.3895 0l-.8342 2.5646c-.0275.0827-.1068.1413-.193.1413H.204c-.1964 0-.2792.2551-.1206.3688l1.8717 1.3616.3103.224c.0723.0518.0999.1448.0758.2275l-.0862.2655-.748 2.2957c-.062.1896.1551.3447.3137.2275l.9479-.6894 1.2306-.8928c.0724-.0517.1689-.0517.2413 0l2.182 1.5856c.1585.1172.3757-.0413.3136-.2275L5.902 5.03c-.0276-.0827 0-.1757.0758-.2275l2.182-1.5856Z" fill="#FFFFFF" transform="translate(17.5585 13.4976)" />
    </svg>
  );
}
