"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDiagnosisResultHistory,
  selectDiagnosisResult,
} from "@/features/diagnosis/diagnosis.api";
import type { DiagnosisResultHistoryItemDto } from "@/features/diagnosis/diagnosis.dto";
import { getCurrentUser, getHomeJobs } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import styles from "./My.module.css";

export function MyDiagnosisResults() {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [results, setResults] = useState<DiagnosisResultHistoryItemDto[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadResults = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);

    try {
      const response = await getDiagnosisResultHistory(cursor, 20);
      setSelectedResultId(response.selectedResultId);
      setNextCursor(response.nextCursor);
      setResults((current) => {
        const nextItems = response.items.map((item) => ({
          ...item,
          isSelected: item.resultId === response.selectedResultId || item.isSelected,
        }));
        if (!cursor) return nextItems;
        return [
          ...current,
          ...nextItems.filter(
            (item) => !current.some((saved) => saved.resultId === item.resultId),
          ),
        ];
      });
    } finally {
      if (cursor) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getCurrentUser().catch(() => null),
      getHomeJobs().catch(() => null),
      getDiagnosisResultHistory(undefined, 20).catch(() => null),
    ])
      .then(([userResponse, homeResponse, historyResponse]) => {
        if (!alive) return;
        setUser(userResponse?.authenticated ? userResponse.user : null);
        setBookmarkCount(homeResponse?.bookmarkCount ?? 0);
        if (historyResponse) {
          setSelectedResultId(historyResponse.selectedResultId);
          setNextCursor(historyResponse.nextCursor);
          setResults(
            historyResponse.items.map((item) => ({
              ...item,
              isSelected:
                item.resultId === historyResponse.selectedResultId || item.isSelected,
            })),
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          void loadResults(nextCursor);
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadResults, loadingMore, nextCursor]);

  const nickname = useMemo(
    () => user?.nickname || user?.displayName || "회원",
    [user],
  );

  const handleSelect = async (resultId: string) => {
    if (selectingId) return;
    setSelectingId(resultId);
    try {
      await selectDiagnosisResult(resultId);
      setSelectedResultId(resultId);
      setResults((current) =>
        current.map((item) => ({ ...item, isSelected: item.resultId === resultId })),
      );
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <AppHeader user={user} nickname={nickname} bookmarkCount={bookmarkCount} />
      <main className={styles.frame}>
        <h1 className={styles.title}>강점·성향 진단 결과</h1>

        {!loading && results.length === 0 ? (
          <section className={styles.diagnosisEmptyState}>
            <div className={styles.diagnosisEmptyCard}>
              <Image
                src="/my/diagnosis-empty-owl.png"
                alt=""
                width={125}
                height={134}
                className={styles.diagnosisEmptyImage}
              />
              <strong>
                현재 검사한 결과가 없습니다.
                <br />
                검사를 진행하세요.
              </strong>
            </div>
            <Link href="/ai-tools/diagnosis" className={styles.diagnosisEmptyButton}>
              강점·성향 진단 검사하러 가기 →
            </Link>
          </section>
        ) : null}

        <div className={styles.resumeList}>
          {results.map((result) => {
            const isSelected = result.resultId === selectedResultId || result.isSelected;
            return (
              <article key={result.resultId} className={styles.resumeCard}>
                <strong className={styles.resumeTitle}>{result.typeName}</strong>
                <time className={styles.resumeDate}>
                  {formatDate(result.completedAt)}
                </time>
                {isSelected ? (
                  <span className={styles.selectedMark}>✓ 선택됨</span>
                ) : null}
                <div className={styles.cardActions}>
                  <Link
                    href={`/ai-tools/diagnosis/result?resultId=${encodeURIComponent(
                      result.resultId,
                    )}`}
                    className={styles.smallButton}
                  >
                    결과보기
                  </Link>
                  {!isSelected ? (
                    <button
                      type="button"
                      className={styles.smallButton}
                      disabled={selectingId === result.resultId}
                      onClick={() => handleSelect(result.resultId)}
                    >
                      {selectingId === result.resultId ? "선택 중" : "선택하기"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {loading ? <p className={styles.loadingText}>진단 결과를 불러오고 있어요.</p> : null}
        <div ref={sentinelRef} className={styles.loadingText}>
          {loadingMore ? "이전 진단 결과를 더 불러오고 있어요." : null}
        </div>
      </main>
      <AppFooter active="my" />
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\.$/, "");
}
