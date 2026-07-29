"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { getCurrentUser, logoutCurrentUser } from "../home.api";
import type { CurrentUserDto } from "../home.dto";
import styles from "./HomeMain.module.css";

const hotJobs = [
  { id: "hot-1", dday: "D-32", title: "OO공사 신입 채용", meta: "정규직 · 수도권" },
  { id: "hot-2", dday: "D-32", title: "▽▽재단 상반기 공채", meta: "정규직 · 수도권" },
  { id: "hot-3", dday: "D-32", title: "OO공사 신입 채용", meta: "정규직 · 수도권" },
];

const aiTools = [
  {
    href: "#",
    tag: "첫 1회 무료",
    title: "Ai 자소서 코칭",
    description: "합격하는 문장으로 AI가 다듬어 드려요.",
    image: "/home/home-tool-diagnosis.png",
    imageAlt: "Ai 자소서 코칭",
  },
  {
    href: "/ai-tools/diagnosis",
    tag: "완전 무료",
    title: "강점·성향 진단",
    description: "10문항이면 끝, 내 강점 유형을 알려드려요.",
    image: "/home/home-tool-match.png",
    imageAlt: "강점·성향 진단",
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
  },
];

const recommendedJobs = [
  {
    id: "rec-1",
    company: "한전KDN",
    title: "한전KDN(주) 구미지사 AMI분야 일용근로자 모집공고",
    meta: "~ 2026. 07. 28(화)",
    dday: "D-1",
    employment: "정규직",
    region: "서울",
    experience: "신입/경력",
  },
  {
    id: "rec-2",
    company: "한전KDN",
    title: "한전KDN(주) 구미지사 AMI분야 일용근로자 모집공고",
    meta: "~ 2026. 07. 28(화)",
    dday: "D-5",
    employment: "정규직",
    region: "서울",
    experience: "신입/경력",
  },
  {
    id: "rec-3",
    company: "한전KDN",
    title: "한전KDN(주) 구미지사 AMI분야 일용근로자 모집공고",
    meta: "~ 2026. 07. 28(화)",
    dday: "D-5",
    employment: "정규직",
    region: "서울",
    experience: "신입/경력",
  },
  {
    id: "rec-4",
    company: "한전KDN",
    title: "한전KDN(주) 구미지사 AMI분야 일용근로자 모집공고",
    meta: "~ 2026. 07. 28(화)",
    dday: "D-5",
    employment: "정규직",
    region: "서울",
    experience: "신입/경력",
  },
  {
    id: "rec-5",
    company: "한전KDN",
    title: "[대전보훈병원] 계약직(청년인턴(장애인)) 채용공고 한...",
    meta: "~ 2026. 07. 28(화)",
    dday: "D-5",
    employment: "정규직",
    region: "서울",
    experience: "신입/경력",
  },
];

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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

  const nickname = useMemo(() => {
    if (isLoading) return "";
    return user?.nickname || user?.displayName || "회원";
  }, [isLoading, user]);
  const diagnosisTypeName = user?.diagnosisTypeName || "진단 결과 확인";

  const startHotDrag = (event: PointerEvent<HTMLDivElement>) => {
    const target = hotListRef.current;
    if (!target) return;

    dragRef.current = {
      isDown: true,
      startX: event.clientX,
      scrollLeft: target.scrollLeft,
    };
    draggedRef.current = false;
    target.setPointerCapture(event.pointerId);
  };

  const moveHotDrag = (event: PointerEvent<HTMLDivElement>) => {
    const target = hotListRef.current;
    if (!target || !dragRef.current.isDown) return;

    const distance = event.clientX - dragRef.current.startX;
    if (Math.abs(distance) > 4) {
      draggedRef.current = true;
      event.preventDefault();
    }
    target.scrollLeft = dragRef.current.scrollLeft - distance;
  };

  const endHotDrag = () => {
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
      setIsMenuOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const ignoreClickAfterDrag = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!draggedRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  return (
    <main className={styles.page}>
      <section className={styles.mobileFrame} aria-label="공부엉이 메인">
        <header className={styles.header}>
          <Link href="/" className={styles.logoLink} aria-label="공부엉이 홈">
            <span className={styles.logoAccent}>공</span>부엉이
          </Link>
          <div className={styles.headerActions}>
            <Link href="#" aria-label="알림" className={styles.iconButton}>
              <BellIcon />
            </Link>
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

          <section className={styles.resultBanner}>
            {user ? (
              <>
                <p>
                  <span>{nickname}</span>님의 진단 결과
                </p>
                <strong>{diagnosisTypeName}</strong>
              </>
            ) : (
              <p className={styles.resultLoginMessage}>로그인이 필요합니다.</p>
            )}
            <Link href="/ai-tools/diagnosis" className={styles.resultLink}>
              <span>{user ? "결과 자세히 보기" : "진단 시작하기"}</span>
              <b aria-hidden="true">→</b>
            </Link>
            <Image
              src="/home/home-main-owl.png"
              alt=""
              width={208}
              height={150}
              className={styles.resultOwl}
              priority
              sizes="208px"
            />
          </section>

        <SectionHeader icon="🔥" title="Hot 공고" href="#" />
        <div
          ref={hotListRef}
          className={styles.hotList}
          onPointerDown={startHotDrag}
          onPointerMove={moveHotDrag}
          onPointerUp={endHotDrag}
          onPointerCancel={endHotDrag}
          onPointerLeave={endHotDrag}
        >
          {hotJobs.map((job) => (
            <Link href="#" key={job.id} className={styles.hotCard} onClickCapture={ignoreClickAfterDrag}>
              <span className={styles.hotBadge}>{job.dday}</span>
              <strong>{job.title}</strong>
              <small>{job.meta}</small>
            </Link>
          ))}
        </div>

        <SectionHeader title="Ai 취업 도구" href="#" />
        <div className={styles.toolList}>
          {aiTools.map((tool) => (
            <Link href={tool.href} key={tool.title} className={styles.toolCard}>
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
            </Link>
          ))}
        </div>

        <div className={styles.contentBand}>
          <SectionHeader title="진단결과 추천 공고" href="#" />
          <div className={styles.listGroup}>
            {recommendedJobs.map((job) => (
              <Link href="#" key={job.id} className={styles.listItem}>
                <span className={styles.recommendTop}>
                  <small className={styles.company}>{job.company}</small>
                  <span className={styles.recommendDday}>{job.dday}</span>
                </span>
                <strong>{job.title}</strong>
                <span className={styles.recommendTags}>
                  <small>{job.employment}</small>
                  <small>{job.region}</small>
                  <small>{job.experience}</small>
                </span>
                <small className={styles.recommendDate}>{job.meta}</small>
              </Link>
            ))}
          </div>

          <SectionHeader title="커뮤니티" href="#" />
          <div className={styles.listGroup}>
            {communityPosts.map((post) => (
              <Link href="#" key={post.id} className={styles.communityItem}>
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
          <Link href="#">
            <CalendarIcon />
            <span>캘린더</span>
          </Link>
          <Link href="/ai-tools/diagnosis">
            <AiIcon />
            <span>Ai 도구</span>
          </Link>
          <Link href="#">
            <CommunityIcon />
            <span>커뮤니티</span>
          </Link>
          <Link href="#">
            <MyIcon />
            <span>MY</span>
          </Link>
        </footer>

        {isMenuOpen ? (
          <aside className={styles.menuOverlay} aria-modal="true" role="dialog" aria-label="메뉴">
            <button type="button" className={styles.menuDim} aria-label="메뉴 닫기" onClick={closeMenu} />
            <div className={styles.drawer}>
              <header className={styles.drawerHeader}>
                <div className={styles.drawerAvatar} aria-hidden="true">
                  🐵
                </div>
                <div>
                  <strong>{nickname || "회원"}</strong>
                  <p>프로필을 수정 할 수 있습니다.</p>
                </div>
                <button type="button" className={styles.drawerClose} aria-label="메뉴 닫기" onClick={closeMenu}>
                  ×
                </button>
              </header>

              <nav className={styles.drawerNav} aria-label="전체 메뉴">
                <DrawerSection icon="home" title="홈" />
                <DrawerSection
                  icon="megaphone"
                  title="채용 공고"
                  items={[
                    "마감 임박 공고",
                    "진단결과 추천 공고",
                    "적합 공고",
                  ]}
                  badge="7"
                />
                <DrawerSection
                  icon="calendar"
                  title="캘린더"
                  items={[
                    "전체 채용 캘린더",
                    "나만의 캘린더",
                  ]}
                />
                <DrawerSection
                  icon="ai"
                  title="AI 도구"
                  label="BEST"
                  items={[
                    "AI 자소서 코칭",
                    "AI 면접 코칭",
                    "직무 성향 진단",
                    "심리·직무 테스트 모음",
                  ]}
                />
                <DrawerSection
                  icon="community"
                  title="커뮤니티"
                  items={[
                    "인기글",
                    "내 또래 인기글",
                    "내 글 · 댓글",
                  ]}
                />
                <DrawerSection icon="my" title="마이페이지" />
              </nav>

              {user ? (
                <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
                </button>
              ) : (
                <Link href="/ai-tools/diagnosis" className={styles.loginButton}>
                  진단 시작하기
                </Link>
              )}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function DrawerSection({
  icon,
  title,
  items = [],
  label,
  badge,
}: {
  icon: "home" | "megaphone" | "calendar" | "ai" | "community" | "my";
  title: string;
  items?: string[];
  label?: string;
  badge?: string;
}) {
  return (
    <section className={styles.drawerSection}>
      <div className={styles.drawerIcon} data-icon={icon} aria-hidden="true">
        {getDrawerIcon(icon)}
      </div>
      <div className={styles.drawerSectionBody}>
        <h3>
          {title}
          {label ? <span className={styles.drawerLabel}>{label}</span> : null}
        </h3>
        {items.length > 0 ? (
          <ul>
            {items.map((item, index) => (
              <li key={item}>
                <Link href="#">
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
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 10.6 12 3.5l8.5 7.1v9.2h-5.4v-6.1H8.9v6.1H3.5v-9.2Z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "megaphone") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.2v3.6h3.2l7.7 4.2V6l-7.7 4.2H4Z" fill="currentColor" />
        <path d="m15 9 4.8-2.1v10.2L15 15V9ZM7.2 14l1.4 5h3l-1.8-4.1L7.2 14Z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2.5" fill="currentColor" opacity=".18" />
        <path d="M3 9h18M7 3v4M17 3v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12h3v3H7v-3Zm7 0h3v3h-3v-3Z" fill="currentColor" />
      </svg>
    );
  }

  if (icon === "ai") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4V2m-1 0h2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="3" y="5" width="18" height="15" rx="5" fill="currentColor" />
        <circle cx="8.5" cy="12" r="1.5" fill="#fff" />
        <circle cx="15.5" cy="12" r="1.5" fill="#fff" />
        <path d="M9 16h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "community") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="currentColor" />
        <circle cx="16" cy="8" r="3" fill="currentColor" opacity=".75" />
        <path d="M2.8 19c.4-4.1 2.2-6.1 5.2-6.1s4.8 2 5.2 6.1H2.8Zm8 0c.2-3.4 1.9-5.3 5.2-5.3 3 0 4.8 1.8 5.2 5.3H10.8Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7.5" r="4" fill="currentColor" />
      <path d="M4.5 21c.5-5.1 3-7.6 7.5-7.6s7 2.5 7.5 7.6h-15Z" fill="currentColor" />
      <circle cx="18.5" cy="17.5" r="3.5" fill="#f5b91e" />
      <path d="M18.5 15.8v1.9l1.2.8" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
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

function MenuIcon() {
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
      <Link href={href}>전체 보기</Link>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true">
      <path d="M4 11.5 12.5 4l8.5 7.5v9H15v-6H10v6H4v-9Z" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="25" height="27" viewBox="0 0 25 27" aria-hidden="true">
      <path
        d="M3 7.5h19v16H3v-16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M3 11h19M7 4v6M18 4v6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="16" r="1.1" fill="currentColor" />
      <circle cx="12.5" cy="16" r="1.1" fill="currentColor" />
      <circle cx="17" cy="16" r="1.1" fill="currentColor" />
      <circle cx="8" cy="20" r="1.1" fill="currentColor" />
      <circle cx="12.5" cy="20" r="1.1" fill="currentColor" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true">
      <rect x="4" y="5" width="17" height="14" rx="3" fill="currentColor" />
      <circle cx="9" cy="12" r="1.2" fill="#fff" />
      <circle cx="16" cy="12" r="1.2" fill="#fff" />
      <path d="M10 16h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true">
      <path
        d="M5 7.5h15v9H9.3L5 20v-3.5H5v-9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MyIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true">
      <circle cx="12.5" cy="8.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 21c1-4 3.6-6 7-6s6 2 7 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
