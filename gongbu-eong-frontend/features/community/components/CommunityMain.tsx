"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCommunityPosts } from "../community.api";
import type { CommunityPostSummaryDto } from "../community.dto";
import { CategoryChips, CommunityQuickActions, CommunitySearchBar, EmptyState, isCommunityCategory, Pagination, PostItem } from "./CommunityShared";
import styles from "./Community.module.css";

const PAGE_SIZE = 20;

export function CommunityMain({
  initialCategory,
  initialQuery,
  initialSort,
  initialPage,
}: {
  initialCategory?: string;
  initialQuery?: string;
  initialSort?: "latest" | "popular";
  initialPage?: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CommunityPostSummaryDto[]>([]);
  const [popular, setPopular] = useState<CommunityPostSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"latest" | "popular">(initialSort || "latest");
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage || 1));
  const [popularPeriod, setPopularPeriod] = useState<"today" | "week">("week");
  const [message, setMessage] = useState("");
  const selectedCategory = isCommunityCategory(initialCategory || "") ? initialCategory! : "전체";
  const query = initialQuery || "";
  const visiblePopular = popular.slice(0, 5);

  useEffect(() => {
    let active = true;
    getCommunityPosts({
      q: query,
      category: selectedCategory,
      sort,
      popularPeriod,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    })
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setPopular(response.popular);
        setTotal(response.total);
      })
      .catch((error) => active && setMessage(error instanceof Error ? error.message : "커뮤니티 글을 불러오지 못했습니다."));

    return () => {
      active = false;
    };
  }, [currentPage, query, popularPeriod, selectedCategory, sort]);

  const searchHref = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCategory !== "전체") params.set("category", selectedCategory);
    if (sort !== "latest") params.set("sort", sort);
    return `/community/search${params.size ? `?${params.toString()}` : ""}`;
  }, [selectedCategory, sort]);

  const goSearch = (nextQuery: string) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (selectedCategory !== "전체") params.set("category", selectedCategory);
    router.push(`/community${params.size ? `?${params.toString()}` : ""}`);
  };

  const changeSort = (nextSort: "latest" | "popular") => {
    setSort(nextSort);
    setCurrentPage(1);
  };

  const changePage = (page: number) => {
    setCurrentPage(page);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedCategory !== "전체") params.set("category", selectedCategory);
    if (sort !== "latest") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    router.push(`/community${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };

  return (
    <div className={styles.page}>
      <section className={styles.frame}>
        <AppHeader />
        <main className={styles.content}>
          <h1>커뮤니티</h1>
          {query ? (
            <CommunitySearchBar initialValue={query} onSearch={goSearch} />
          ) : (
            <Link href={searchHref} className={styles.searchBox}>
              <span>제목 · 내용을 검색해 보세요.</span>
              <Image src="/community/search.svg" alt="" width={25} height={25} />
            </Link>
          )}
          <CategoryChips
            selected={selectedCategory}
            toHref={(category) => {
              const params = new URLSearchParams();
              if (category !== "전체") params.set("category", category);
              if (query) params.set("q", query);
              return `/community${params.size ? `?${params.toString()}` : ""}`;
            }}
          />

          {query ? null : (
            <section className={styles.popularSection}>
              <div className={styles.sectionHeader}>
                <h2>전체 인기글</h2>
                <div className={styles.segment}>
                  <button className={popularPeriod === "today" ? styles.selected : ""} onClick={() => setPopularPeriod("today")}>오늘</button>
                  <button className={popularPeriod === "week" ? styles.selected : ""} onClick={() => setPopularPeriod("week")}>주간</button>
                </div>
              </div>
              <div className={styles.popularList}>
                {visiblePopular.map((post, index) => <PostItem key={post.id} post={post} rank={index + 1} />)}
                {!visiblePopular.length ? <EmptyState>인기글이 아직 없습니다.</EmptyState> : null}
              </div>
            </section>
          )}

          <div className={`${styles.sectionHeader} ${styles.allPostsHeader}`}>
            <h2>{query ? `‘${query}’ 검색 결과` : "전체 글"}</h2>
            <div className={styles.sortButtons}>
              <button className={sort === "latest" ? styles.sortActive : ""} onClick={() => changeSort("latest")}>최신순</button>
              <span>|</span>
              <button className={sort === "popular" ? styles.sortActive : ""} onClick={() => changeSort("popular")}>인기순</button>
            </div>
          </div>
          <div className={styles.postList}>
            {items.map((post) => <PostItem key={post.id} post={post} />)}
            {!items.length ? <EmptyState>{query ? `‘${query}’에 대한 검색 결과가 없어요.` : "등록된 글이 없습니다."}<br />첫 글을 작성해 보세요.</EmptyState> : null}
          </div>
          {message ? <p className={styles.toast}>{message}</p> : null}
          <Pagination
            currentPage={currentPage}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={changePage}
            showSinglePage
          />
        </main>
        {!query ? <CommunityQuickActions /> : null}
        <AppFooter active="community" />
      </section>
    </div>
  );
}
