"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listInterviewCoachingHistory } from "@/features/interview-coaching/interview-coaching.api";
import type { InterviewCoachingSession } from "@/features/interview-coaching/interview-coaching.dto";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import styles from "../coaching/CoachingHistoryPage.module.css";

type HistoryFilter = "all" | "linked" | "general";
type InterviewHistoryItem = {
  id: string;
  kind: "interview";
  createdAt: string;
  title: string;
  subtitle: string;
  score: number | null;
  isLinked: boolean;
  href: string;
  status: InterviewCoachingSession["status"];
};

const PAGE_SIZE = 10;

export default function InterviewCoachingHistoryPage() {
  const [items, setItems] = useState<InterviewCoachingSession[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    listInterviewCoachingHistory(getAnonymousId())
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const unifiedItems = useMemo(
    () => sortRecent(items.map(mapInterviewHistoryItem)),
    [items],
  );
  const linkedItems = useMemo(() => unifiedItems.filter((item) => item.isLinked), [unifiedItems]);
  const generalItems = useMemo(() => unifiedItems.filter((item) => !item.isLinked), [unifiedItems]);
  const displayItems = useMemo(() => {
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
        <h1>내 AI NCS 면접 코칭 기록</h1>

        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <strong>AI NCS 면접 코칭 기록을 확인하세요.</strong>
            <span>총 {items.length}건</span>
          </div>
          <Image src="/coaching/history-hero.png" alt="" width={172} height={142} className={styles.heroImage} priority />
        </section>

        <section className={styles.historySection}>
          <div className={styles.sectionTitle}>
            <h2>AI NCS 면접 코칭 목록</h2>
            <span>{displayItems.length}건</span>
          </div>

          <div className={styles.filterTabs} role="tablist" aria-label="AI NCS 면접 코칭 기록 필터">
            <button type="button" className={filter === "all" ? styles.activeFilter : undefined} onClick={() => changeFilter("all")}>
              전체
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
                <HistoryJobCard item={item} key={item.id} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <p>저장된 AI NCS 면접 코칭 기록이 없습니다.</p>
              <Link href="/ai-tools/interview-coaching">AI NCS 면접 코칭 받기</Link>
            </div>
          )}

          {displayItems.length > PAGE_SIZE ? (
            <nav className={styles.pagination} aria-label="AI NCS 면접 코칭 목록 페이지">
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

function HistoryJobCard({ item }: { item: InterviewHistoryItem }) {
  const score = item.score == null ? null : Math.max(0, Math.min(100, Math.round(Number(item.score) || 0)));
  const date = formatDate(item.createdAt);

  return (
    <Link href={item.href} className={styles.historyCard}>
      <span className={styles.scoreBox}>{score == null ? "-" : score}</span>
      <div className={styles.cardBody}>
        <div className={styles.badges}>
          <span className={styles.readyPill}>AI NCS 면접 코칭</span>
          <span className={item.isLinked ? styles.linkedPill : styles.generalPill}>
            {item.isLinked ? "공고 연결" : "일반"}
          </span>
          {item.status !== "completed" ? <span className={styles.generalPill}>{formatInterviewStatus(item.status)}</span> : null}
        </div>
        <strong>{item.title}</strong>
        <small className={styles.cardSubtitle}>{item.subtitle}</small>
        <time>{date}</time>
      </div>
      <span className={styles.chevron} aria-hidden="true">{">"}</span>
    </Link>
  );
}

function mapInterviewHistoryItem(item: InterviewCoachingSession): InterviewHistoryItem {
  const isLinked = Boolean(item.job);
  return {
    id: item.id,
    kind: "interview",
    createdAt: item.createdAt,
    title: item.job
      ? makeJobTitle(item.job.institutionName, item.job.title)
      : `${item.companyName || "기업 미정"} ${item.positionName || "직무 미정"}`.trim(),
    subtitle: item.result?.summary || item.dutyText || "AI NCS 면접 코칭",
    score: item.result?.score ?? null,
    isLinked,
    href: `/my/interview-coaching/${item.id}`,
    status: item.status,
  };
}

function sortRecent<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
