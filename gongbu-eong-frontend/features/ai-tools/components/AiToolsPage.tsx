"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { ComingSoonAlert } from "@/features/layout/components/ComingSoonAlert";
import { getAiToolEvents } from "../ai-tools.api";
import type { AiToolEventDto } from "../ai-tools.dto";
import styles from "./AiToolsPage.module.css";

const representativeTools = [
  {
    href: "/ai-tools/diagnosis",
    badge: "완전 무료",
    badgeTone: "blue",
    title: "강점·성향 진단",
    description: "10문항이면 끝, 내 강점 유형을 알려드려요.",
    image: "/ai-tools/tool-diagnosis.png",
    imageAlt: "강점·성향 진단",
    thumbClass: "toolThumbDiagnosis",
    imageWidth: 86,
    imageHeight: 79,
    requiresAuth: false,
    comingSoon: false,
  },
  {
    href: "/ai-tools/coaching",
    badge: "첫 1회 무료",
    badgeTone: "green",
    title: "NCS AI 자소서 코칭",
    description: "합격하는 문장으로 AI가 다듬어 드려요.",
    image: "/ai-tools/tool-resume.png",
    imageAlt: "NCS AI 자소서 코칭",
    thumbClass: "toolThumbResume",
    imageWidth: 94,
    imageHeight: 78,
    requiresAuth: true,
    comingSoon: false,
  },
  {
    href: "#",
    badge: "준비중",
    badgeTone: "red",
    title: "AI 면접 코칭",
    description: "실전처럼 연습하고 면접 울렁증 극복해요.",
    image: "/ai-tools/tool-failure.png",
    imageAlt: "AI 면접 코칭",
    thumbClass: "toolThumbFailure",
    imageWidth: 86,
    imageHeight: 80,
    requiresAuth: false,
    comingSoon: true,
  },
] as const;

const jobTools = [
  { icon: "/ai-tools/icon-salary.png", title: "연봉 계산기", href: "/ai-tools/job-tools?tool=salary" },
  { icon: "/ai-tools/icon-textcheck.png", title: "글자수세기", href: "/ai-tools/job-tools?tool=text" },
  { icon: "/ai-tools/icon-severance.png", title: "퇴직금 계산기", href: "/ai-tools/job-tools?tool=severance" },
  { icon: "/ai-tools/icon-vacation.png", title: "연차/휴가 계산기", href: "/ai-tools/job-tools?tool=vacation" },
  { icon: "/ai-tools/icon-unemployment.png", title: "실업급여 계산기", href: "/ai-tools/job-tools?tool=unemployment" },
  { icon: "/ai-tools/icon-grade.png", title: "학점 계산기", href: "/ai-tools/job-tools?tool=grade" },
] as const;

export function AiToolsPage({
  initialEvents = [],
}: {
  initialEvents?: AiToolEventDto[];
}) {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [events, setEvents] = useState<AiToolEventDto[]>(initialEvents);
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then((response) => {
        if (mounted) setUser(response.authenticated ? response.user : null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthResolved(true);
      });

    getAiToolEvents()
      .then((response) => {
        if (mounted) setEvents(response.items);
      })
      .catch(() => {
        if (mounted) setEvents([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isLoggedIn = Boolean(user);

  return (
    <main className={styles.page}>
      <section className={styles.mobileFrame} aria-label="AI 도구">
        <AppHeader
          user={authResolved ? user : undefined}
          ticketCount={user?.creditBalance}
        />

        <div className={styles.content}>
          <header className={styles.titleBlock}>
            <h1>AI 도구</h1>
            <p>취업 준비의 모든 과정을 AI가 함께 도와드려요.</p>
          </header>

          {isLoggedIn ? (
            <Link
              href="/my/diagnosis-results"
              className={`${styles.hero} ${styles.heroLoggedIn}`}
              aria-label="검사결과 확인하기"
            >
              <div className={styles.heroCopy}>
                <strong>
                  검사한 정보들은
                  <br />
                  마이페이지에 있습니다.
                </strong>
                <span className={styles.heroButton}>검사결과 확인하기</span>
              </div>
              <Image
                src="/ai-tools/hero-logged-in.png"
                alt=""
                width={130}
                height={139}
                className={styles.heroOwlLoggedIn}
                priority
                sizes="130px"
              />
            </Link>
          ) : (
            <section className={`${styles.hero} ${styles.heroLoggedOut}`}>
              <div className={styles.heroCopy}>
                <strong>
                  로그인하고
                  <br />
                  공부엉이의 <span>AI 도구</span>를
                  <br />
                  사용하세요.
                </strong>
                <Link href="/login" className={styles.heroButton}>로그인하고 검사하기</Link>
              </div>
              <Image
                src="/ai-tools/hero-logged-out.png"
                alt=""
                width={147}
                height={139}
                className={styles.heroOwlLoggedOut}
                priority
                sizes="147px"
              />
            </section>
          )}

          <SectionTitle title="대표 AI 도구" icon="/ai-tools/icon-pin.png" />
          <div className={styles.toolList}>
            {representativeTools.map((tool) => {
              const card = (
                <>
                  <span className={styles.toolCopy}>
                    <em className={styles[`badge_${tool.badgeTone}`]}>{tool.badge}</em>
                    <strong>{tool.title}</strong>
                    <small>{tool.description}</small>
                  </span>
                  <span className={`${styles.toolThumb} ${styles[tool.thumbClass]}`}>
                    <Image
                      src={tool.image}
                      alt={tool.imageAlt}
                      width={tool.imageWidth}
                      height={tool.imageHeight}
                      sizes={`${tool.imageWidth}px`}
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
                    {card}
                  </button>
                );
              }

              return (
                <Link
                  href={tool.requiresAuth && !user ? "/login" : tool.href}
                  key={tool.title}
                  className={styles.toolCard}
                >
                  {card}
                </Link>
              );
            })}
          </div>

          {events.length > 0 ? (
            <section className={styles.eventSection}>
              <SectionTitle
                title="재미로 보는 최신 심리테스트"
                badge="NEW"
              />
              <div className={styles.eventScroller}>
                {events.map((event) => (
                  <Link href={event.href} key={event.eventNo} className={styles.eventCard}>
                    <span className={styles.eventThumb}>
                      <Image
                        src={event.thumbnailUrl || "/diagnosis-share-banner.png"}
                        alt={event.title}
                        fill
                        sizes="160px"
                      />
                    </span>
                    <strong>{event.title}</strong>
                    <small>▶ {formatParticipantCount(event.participantCount)}명</small>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.jobToolSection}>
            <SectionTitle title="공부엉이의 취업 도구" />
            <div className={styles.jobToolList}>
              {jobTools.map((tool) => (
                <Link
                  href={tool.href}
                  key={tool.title}
                  className={styles.jobToolItem}
                >
                  <span className={styles.jobToolIcon} aria-hidden="true">
                    <Image src={tool.icon} alt="" width={24} height={24} unoptimized />
                  </span>
                  <span>{tool.title}</span>
                  <b aria-hidden="true">›</b>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <AppFooter active="ai" />
        {isComingSoonOpen ? (
          <ComingSoonAlert onClose={() => setIsComingSoonOpen(false)} />
        ) : null}
      </section>
    </main>
  );
}

function SectionTitle({
  title,
  icon,
  badge,
}: {
  title: string;
  icon?: string;
  badge?: string;
}) {
  return (
    <div className={styles.sectionTitle}>
      {icon ? <Image src={icon} alt="" width={18} height={18} unoptimized /> : null}
      <h2>{title}</h2>
      {badge ? <span>{badge}</span> : null}
    </div>
  );
}

function formatParticipantCount(value: number) {
  if (value >= 10000) {
    const unit = value / 10000;
    return `${Number.isInteger(unit) ? unit.toFixed(0) : unit.toFixed(1)}만`;
  }

  if (value >= 1000) {
    const unit = value / 1000;
    return `${Number.isInteger(unit) ? unit.toFixed(0) : unit.toFixed(1)}천`;
  }

  return value.toLocaleString("ko-KR");
}
