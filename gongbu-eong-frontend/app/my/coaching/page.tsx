"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listCoachingHistory } from "@/features/coaching/coaching.api";
import type { CoachingHistoryItem } from "@/features/coaching/coaching.dto";
import styles from "./CoachingHistoryPage.module.css";

type HistoryFilter = "all" | "linked" | "general";

const PAGE_SIZE = 8;

export default function CoachingHistoryPage() {
  const [items, setItems] = useState<CoachingHistoryItem[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
    return [...linkedItems, ...generalItems];
  }, [filter, generalItems, linkedItems]);
  const visibleItems = displayItems.slice(0, visibleCount);

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

        {linkedItems.length ? (
          <section className={styles.interviewList} aria-label="면접 준비 공고">
            {linkedItems.slice(0, 2).map((item) => (
              <HistoryJobCard item={item} variant="interview" key={`interview-${item.id}`} />
            ))}
          </section>
        ) : null}

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

          {visibleCount < displayItems.length ? (
            <button type="button" className={styles.moreButton} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              더 보기
            </button>
          ) : null}
        </section>
      </main>
      <AppFooter active="my" />
    </div>
  );

  function changeFilter(nextFilter: HistoryFilter) {
    setFilter(nextFilter);
    setVisibleCount(PAGE_SIZE);
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
