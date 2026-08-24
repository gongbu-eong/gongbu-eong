"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listCoachingHistory } from "@/features/coaching/coaching.api";
import type { CoachingHistoryItem } from "@/features/coaching/coaching.dto";
import styles from "./CoachingHistoryPage.module.css";

type HistoryFilter = "all" | "linked" | "general";

const PAGE_SIZE = 10;

export default function CoachingHistoryPage() {
  const [items, setItems] = useState<CoachingHistoryItem[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    listCoachingHistory()
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

  const linkedItems = useMemo(() => sortRecent(items.filter((item) => item.job)), [items]);
  const generalItems = useMemo(() => sortRecent(items.filter((item) => !item.job)), [items]);
  const displayItems = useMemo(() => {
    if (filter === "linked") return linkedItems;
    if (filter === "general") return generalItems;
    return sortRecent(items);
  }, [filter, generalItems, items, linkedItems]);
  const pageCount = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = displayItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.frame}>
        <h1>내 자소서 코칭 기록</h1>

        <section className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <strong>면접 준비할 공고를 골라보세요</strong>
            <span>코칭받은&nbsp;{linkedItems.length}개 공고의 면접을 대비할 수 있어요.</span>
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
                <HistoryJobCard item={item} variant="history" key={item.id} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyCard}>
              <p>저장된 자소서 코칭 기록이 없습니다.</p>
              <Link href="/ai-tools/coaching">자소서 코칭 받기</Link>
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

function HistoryJobCard({ item, variant }: { item: CoachingHistoryItem; variant: "interview" | "history" }) {
  const score = Math.max(0, Math.min(100, Math.round(Number(item.result?.score) || 0)));
  const isLinked = Boolean(item.job);
  const title = item.job ? makeJobTitle(item.job.institutionName, item.job.title) : "공고 연결 없이 받은 코칭";
  const date = formatDate(item.createdAt);

  return (
    <Link href={`/my/coaching/${item.id}`} className={variant === "interview" ? styles.interviewCard : styles.historyCard}>
      {variant === "history" ? <span className={styles.scoreBox}>{score}</span> : null}
      <div className={styles.cardBody}>
        <div className={styles.badges}>
          {variant === "interview" ? <span className={styles.scorePill}>{score}점</span> : null}
          <span className={isLinked ? styles.linkedPill : styles.generalPill}>{isLinked ? "공고 연결 코칭" : "일반 코칭"}</span>
          {variant === "interview" ? <span className={styles.readyPill}>면접 준비</span> : null}
        </div>
        <strong>{title}</strong>
        {variant === "history" ? <time>{date}</time> : null}
      </div>
      <span className={styles.chevron} aria-hidden="true">{">"}</span>
    </Link>
  );
}

function sortRecent(items: CoachingHistoryItem[]) {
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
