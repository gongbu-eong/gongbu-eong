"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listCoachingHistory } from "@/features/coaching/coaching.api";
import type { CoachingHistoryItem } from "@/features/coaching/coaching.dto";
import { listInterviewCoachingHistory } from "@/features/interview-coaching/interview-coaching.api";
import type { InterviewCoachingSession } from "@/features/interview-coaching/interview-coaching.dto";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import styles from "./CoachingHistoryPage.module.css";

type HistoryFilter = "all" | "resume" | "interview" | "linked" | "general";
type UnifiedHistoryItem = {
  id: string;
  kind: "resume" | "interview";
  createdAt: string;
  title: string;
  subtitle: string;
  score: number | null;
  isLinked: boolean;
  href: string;
  status?: InterviewCoachingSession["status"];
};

const PAGE_SIZE = 10;

export default function CoachingHistoryPage() {
  const [items, setItems] = useState<CoachingHistoryItem[]>([]);
  const [interviewItems, setInterviewItems] = useState<InterviewCoachingSession[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    Promise.all([
      listCoachingHistory().catch(() => ({ items: [] as CoachingHistoryItem[] })),
      listInterviewCoachingHistory(getAnonymousId()).catch(() => ({
        items: [] as InterviewCoachingSession[],
      })),
    ])
      .then(([coachingResponse, interviewResponse]) => {
        if (!active) return;
        setItems(coachingResponse.items);
        setInterviewItems(interviewResponse.items);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setInterviewItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const unifiedItems = useMemo(
    () => sortRecent([
      ...items.map(mapResumeHistoryItem),
      ...interviewItems.map(mapInterviewHistoryItem),
    ]),
    [interviewItems, items],
  );
  const linkedItems = useMemo(() => unifiedItems.filter((item) => item.isLinked), [unifiedItems]);
  const generalItems = useMemo(() => unifiedItems.filter((item) => !item.isLinked), [unifiedItems]);
  const displayItems = useMemo(() => {
    if (filter === "resume") return unifiedItems.filter((item) => item.kind === "resume");
    if (filter === "interview") return unifiedItems.filter((item) => item.kind === "interview");
    if (filter === "linked") return linkedItems;
    if (filter === "general") return generalItems;
    return unifiedItems;
  }, [filter, generalItems, linkedItems, unifiedItems]);
  const pageCount = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = displayItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.frame}>
        <h1>내 코칭 기록</h1>

        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <strong>내 코칭 기록을 확인하세요.</strong>
            <span>자소서 {items.length}건 · AI 면접 {interviewItems.length}건</span>
          </div>
          <Image src="/coaching/history-hero.png" alt="" width={172} height={142} className={styles.heroImage} priority />
        </section>

        {/* 면접 준비 목록은 추후 재노출 예정입니다.
        {linkedItems.length ? (
          <section className={styles.interviewList} aria-label="면접 준비 공고">
            {linkedItems.slice(0, 2).map((item) => (
              <HistoryJobCard item={item} variant="interview" key={`interview-${item.id}`} />
            ))}
          </section>
        ) : null} */}

        <section className={styles.historySection}>
          <div className={styles.sectionTitle}>
            <h2>코칭 목록</h2>
            <span>{displayItems.length}건</span>
          </div>

          <div className={styles.filterTabs} role="tablist" aria-label="코칭 기록 필터">
            <button type="button" className={filter === "all" ? styles.activeFilter : undefined} onClick={() => changeFilter("all")}>
              전체
            </button>
            <button type="button" className={filter === "resume" ? styles.activeFilter : undefined} onClick={() => changeFilter("resume")}>
              자소서 코칭
            </button>
            <button type="button" className={filter === "interview" ? styles.activeFilter : undefined} onClick={() => changeFilter("interview")}>
              AI 면접 코칭
            </button>
            <button type="button" className={filter === "linked" ? styles.activeFilter : undefined} onClick={() => changeFilter("linked")}>
              공고 연결 코칭
            </button>
            <button type="button" className={filter === "general" ? styles.activeFilter : undefined} onClick={() => changeFilter("general")}>
              일반 코칭
            </button>
          </div>

          {visibleItems.length ? (
            <div className={styles.historyList}>
              {visibleItems.map((item) => (
                <HistoryJobCard item={item} variant="history" key={`${item.kind}-${item.id}`} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <p>저장된 코칭 기록이 없습니다.</p>
              <Link href={filter === "interview" ? "/ai-tools/interview-coaching" : "/ai-tools/coaching"}>
                코칭 받기
              </Link>
            </div>
          )}

          {displayItems.length > PAGE_SIZE ? (
            <nav className={styles.pagination} aria-label="코칭 목록 페이지">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="이전 페이지">
                &lt;
              </button>
              {makePageNumbers(currentPage, pageCount).map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={pageNumber === currentPage ? styles.activePage : undefined}
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                >
                  {pageNumber}
                </button>
              ))}
              <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="다음 페이지">
                &gt;
              </button>
            </nav>
          ) : null}
        </section>
      </main>
      <AppFooter active="my" />
    </div>
  );

  function changeFilter(nextFilter: HistoryFilter) {
    setFilter(nextFilter);
    setPage(1);
  }
}

function HistoryJobCard({ item, variant }: { item: UnifiedHistoryItem; variant: "interview" | "history" }) {
  const score = item.score == null ? null : Math.max(0, Math.min(100, Math.round(Number(item.score) || 0)));
  const date = formatDate(item.createdAt);

  return (
    <Link href={item.href} className={variant === "interview" ? styles.interviewCard : styles.historyCard}>
      {variant === "history" ? <span className={styles.scoreBox}>{score == null ? "-" : score}</span> : null}
      <div className={styles.cardBody}>
        <div className={styles.badges}>
          <span className={item.kind === "interview" ? styles.readyPill : styles.scorePill}>
            {item.kind === "interview" ? "AI 면접 코칭" : "자소서 코칭"}
          </span>
          <span className={item.isLinked ? styles.linkedPill : styles.generalPill}>
            {item.isLinked ? "공고 연결" : "일반"}
          </span>
          {item.status && item.status !== "completed" ? <span className={styles.generalPill}>{formatInterviewStatus(item.status)}</span> : null}
        </div>
        <strong>{item.title}</strong>
        <small className={styles.cardSubtitle}>{item.subtitle}</small>
        {variant === "history" ? <time>{date}</time> : null}
      </div>
      <span className={styles.chevron} aria-hidden="true">{">"}</span>
    </Link>
  );
}

function mapResumeHistoryItem(item: CoachingHistoryItem): UnifiedHistoryItem {
  const isLinked = Boolean(item.job);
  return {
    id: item.id,
    kind: "resume",
    createdAt: item.createdAt,
    title: item.job
      ? makeJobTitle(item.job.institutionName, item.job.title)
      : "공고 연결 없이 받은 자소서 코칭",
    subtitle: item.result?.summary || "AI NCS 자소서 코칭 결과",
    score: item.result?.score ?? null,
    isLinked,
    href: `/my/coaching/${item.id}`,
  };
}

function mapInterviewHistoryItem(item: InterviewCoachingSession): UnifiedHistoryItem {
  const isLinked = Boolean(item.job);
  return {
    id: item.id,
    kind: "interview",
    createdAt: item.createdAt,
    title: item.job
      ? makeJobTitle(item.job.institutionName, item.job.title)
      : `${item.companyName || "기업 미정"} ${item.positionName || "직무 미정"}`.trim(),
    subtitle: item.result?.summary || item.dutyText || "NCS 직무 기반 AI 면접 코칭",
    score: item.result?.score ?? null,
    isLinked,
    href: `/my/interview-coaching/${item.id}`,
    status: item.status,
  };
}

function sortRecent<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function makePageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 10) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const start = Math.min(Math.max(1, currentPage - 4), pageCount - 9);
  return Array.from({ length: 10 }, (_, index) => start + index);
}

function makeJobTitle(institutionName: string, title: string) {
  const normalizedTitle = title.replace(institutionName, "").trim();
  return normalizedTitle ? `${institutionName} ${normalizedTitle}` : institutionName;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}. ${month}. ${day}`;
}

function formatInterviewStatus(status: InterviewCoachingSession["status"]) {
  switch (status) {
    case "draft":
      return "준비 중";
    case "ready":
      return "진행 중";
    case "failed":
      return "오류";
    default:
      return "완료";
  }
}
