"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCommunitySearchMeta } from "../community.api";
import { CommunityQuickActions, CommunitySearchBar } from "./CommunityShared";
import styles from "./Community.module.css";

const STORAGE_KEY = "gongbu-eong-community-recent-searches";

export function CommunitySearchPage({ initialQuery }: { initialQuery?: string }) {
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => setRecent(readRecentSearches()));
    getCommunitySearchMeta().then((response) => setPopular(response.popularQueries)).catch(() => undefined);
  }, []);

  const search = (query: string) => {
    if (!query) return;
    const next = [query, ...recent.filter((item) => item !== query)].slice(0, 6);
    setRecent(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    router.push(`/community?q=${encodeURIComponent(query)}`);
  };

  const removeRecent = (query: string) => {
    const next = recent.filter((item) => item !== query);
    setRecent(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className={styles.page}>
      <section className={styles.frame}>
        <AppHeader />
        <main className={styles.content}>
          <h1>커뮤니티</h1>
          <CommunitySearchBar initialValue={initialQuery} onSearch={search} />
          {recent.length ? (
            <section className={styles.recentSection}>
              <h2>최근 검색어</h2>
              <div className={styles.recentChips}>
                {recent.map((query) => (
                  <span key={query} className={styles.recentChip}>
                    <Link href={`/community?q=${encodeURIComponent(query)}`}>{query}</Link>
                    <button type="button" aria-label={`${query} 삭제`} onClick={() => removeRecent(query)}>
                      <Image src="/community/close.svg" alt="" width={12} height={12} />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          <section className={styles.popularSearchSection}>
            <h2>🔥 인기 검색어</h2>
            {popular.length ? (
              <ol className={styles.keywordList}>
                {popular.map((keyword, index) => (
                  <li key={keyword}>
                    <Link href={`/community?q=${encodeURIComponent(keyword)}`}>
                      <b>{index + 1}</b>
                      <span>{keyword}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : <EmptyPopularSearches />}
          </section>
        </main>
        <CommunityQuickActions />
        <AppFooter active="community" />
      </section>
    </div>
  );
}

function EmptyPopularSearches() {
  return <p className={styles.emptyKeywords}>아직 집계된 인기 검색어가 없습니다.</p>;
}

function readRecentSearches() {
  if (typeof window === "undefined") return [];

  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string").slice(0, 6)
      : [];
  } catch {
    return [];
  }
}
