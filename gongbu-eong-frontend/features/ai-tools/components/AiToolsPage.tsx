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
    image: "/home/home-tool-match.png",
    imageAlt: "강점·성향 진단",
    requiresAuth: false,
    comingSoon: false,
  },
  {
    href: "/ai-tools/coaching",
    badge: "첫 1회 무료",
    badgeTone: "green",
    title: "NCS Ai 자소서 코칭",
    description: "합격하는 문장으로 AI가 다듬어 드려요.",
    image: "/home/home-tool-resume.png",
    imageAlt: "NCS Ai 자소서 코칭",
    requiresAuth: true,
    comingSoon: false,
  },
  {
    href: "#",
    badge: "첫 1회 무료",
    badgeTone: "green",
    title: "Ai 면접 코칭",
    description: "실전처럼 연습하고 면접 울렁증 극복해요.",
    image: "/home/home-tool-interview.png",
    imageAlt: "Ai 면접 코칭",
    requiresAuth: false,
    comingSoon: true,
  },
  {
    href: "#",
    badge: "준비중",
    badgeTone: "red",
    title: "탈락사례 분석",
    description: "왜 떨어졌을까? 곧 데이터로 알려드려요.",
    image: "/home/home-tool-failure.png",
    imageAlt: "탈락사례 분석",
    requiresAuth: false,
    comingSoon: true,
  },
] as const;

const jobTools = [
  { icon: "🧮", title: "연봉 계산기" },
  { icon: "Ⓜ", title: "글자수세기/맞춤법" },
  { icon: "💸", title: "퇴직금 계산기" },
  { icon: "🗓", title: "연차/휴가 계산기" },
  { icon: "💰", title: "실업급여 계산기" },
  { icon: "🎓", title: "학점 계산기" },
] as const;

export function AiToolsPage() {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [events, setEvents] = useState<AiToolEventDto[]>([]);
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
  const diagnosisResultHref = user?.diagnosisResultId
    ? "/ai-tools/diagnosis/result"
    : "/ai-tools/diagnosis";

  return (
    <main className={styles.page}>
      <section className={styles.mobileFrame} aria-label="Ai 도구">
        <AppHeader
          user={authResolved ? user : undefined}
          ticketCount={user?.creditBalance}
        />

        <div className={styles.content}>
          <header className={styles.titleBlock}>
            <h1>Ai 도구</h1>
            <p>공부엉이의 똑똑한 Ai 도구로 취업 준비를 더 쉽게 해보세요.</p>
          </header>

          {isLoggedIn ? (
            <section className={`${styles.hero} ${styles.heroLoggedIn}`}>
              <div className={styles.heroCopy}>
                <strong>
                  검사한 정보들은
                  <br />
                  마이페이지에 있습니다.
                </strong>
                <Link href={diagnosisResultHref}>검사결과 확인하기</Link>
              </div>
              <Image
                src="/home/home-main-owl.png"
                alt=""
                width={200}
                height={200}
                className={styles.heroOwlLoggedIn}
                priority
                sizes="160px"
              />
            </section>
          ) : (
            <section className={`${styles.hero} ${styles.heroLoggedOut}`}>
              <div className={styles.heroCopy}>
                <strong>
                  로그인하고 공부엉이의
                  <br />
                  <span>Ai 도구</span>를 사용하세요.
                </strong>
                <Link href="/login">로그인하고 검사하기</Link>
              </div>
              <Image
                src="/home/home-login-required-owl.png"
                alt=""
                width={175}
                height={175}
                className={styles.heroOwlLoggedOut}
                priority
                sizes="150px"
              />
            </section>
          )}

          <SectionTitle title="📌 대표 AI 도구" />
          <div className={styles.toolList}>
            {representativeTools.map((tool) => {
              const card = (
                <>
                  <span className={styles.toolCopy}>
                    <em className={styles[`badge_${tool.badgeTone}`]}>{tool.badge}</em>
                    <strong>{tool.title}</strong>
                    <small>{tool.description}</small>
                  </span>
                  <span className={styles.toolThumb}>
                    <Image
                      src={tool.image}
                      alt={tool.imageAlt}
                      width={98}
                      height={82}
                      sizes="98px"
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
                <button
                  type="button"
                  key={tool.title}
                  className={styles.jobToolItem}
                  onClick={() => setIsComingSoonOpen(true)}
                >
                  <span className={styles.jobToolIcon} aria-hidden="true">
                    {tool.icon}
                  </span>
                  <span>{tool.title}</span>
                  <b aria-hidden="true">›</b>
                </button>
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
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className={styles.sectionTitle}>
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
