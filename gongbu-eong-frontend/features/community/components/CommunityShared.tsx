"use client";

/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { COMMUNITY_CATEGORIES, type CommunityAuthorDto, type CommunityCategory, type CommunityPostSummaryDto } from "../community.dto";
import { toProfileAvatarSrc } from "../avatar";
import styles from "./Community.module.css";

export const ALL_CATEGORIES = ["전체", ...COMMUNITY_CATEGORIES] as const;

export function CommunitySearchBar({
  initialValue = "",
  onSearch,
}: {
  initialValue?: string;
  onSearch: (query: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(value.trim());
  };

  return (
    <form className={styles.searchBox} onSubmit={submit}>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="제목 · 내용을 검색해 보세요."
      />
      <button type="submit" aria-label="검색">
        <Image src="/community/search.svg" alt="" width={25} height={25} />
      </button>
    </form>
  );
}

export function CategoryChips({
  selected,
  toHref,
}: {
  selected: string;
  toHref: (category: string) => string;
}) {
  return (
    <nav className={styles.categoryScroll} aria-label="커뮤니티 카테고리">
      {ALL_CATEGORIES.map((category) => (
        <Link
          key={category}
          href={toHref(category)}
          className={`${styles.chip} ${selected === category ? styles.chipActive : ""}`}
        >
          {category}
        </Link>
      ))}
    </nav>
  );
}

export function PostItem({
  post,
  rank,
  actions,
}: {
  post: CommunityPostSummaryDto;
  rank?: number;
  actions?: React.ReactNode;
}) {
  if (rank) {
    return (
      <Link href={`/community/${post.id}`} className={styles.popularItem}>
        <span className={styles.rank}>{rank}</span>
        <span className={styles.popularBody}>
          <span className={styles.popularCategory}>{post.category}</span>
          <strong>{post.title}</strong>
          <span className={styles.popularAuthor}>
            {post.author.nickname}
            {post.author.diagnosisTypeName ? <b className={styles.typeBadge}>{post.author.diagnosisTypeName}</b> : null}
          </span>
          <span className={styles.postStats}>
            <span>조회수 : {formatNumber(post.viewCount)}</span>
            <span>추천수 : {formatNumber(post.recommendCount)}</span>
            <span>댓글 : {formatNumber(post.commentCount)}</span>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <article className={styles.postItem}>
      <Link href={`/community/${post.id}`} className={styles.postItemMain}>
        <span className={styles.categoryBadge}>{post.category}</span>
        <strong className={styles.postTitle}>{post.title}</strong>
        <span className={styles.authorLine}>
          <span>{post.author.nickname}</span>
          {post.author.diagnosisTypeName ? <b className={styles.typeBadge}>{post.author.diagnosisTypeName}</b> : null}
        </span>
        <span className={styles.postFooter}>
          <span className={styles.postStats}>
            <span>조회수 : {formatNumber(post.viewCount)}</span>
            <span>추천수 : {formatNumber(post.recommendCount)}</span>
            <span>댓글 : {formatNumber(post.commentCount)}</span>
          </span>
          <time>{formatRelativeTime(post.createdAt)}</time>
        </span>
      </Link>
      {actions}
    </article>
  );
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  showSinglePage = false,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  showSinglePage?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const groupStart = Math.floor((currentPage - 1) / 10) * 10 + 1;
  const pages = Array.from({ length: Math.min(10, totalPages - groupStart + 1) }, (_, index) => groupStart + index);

  if (totalItems <= 0 || (totalPages <= 1 && !showSinglePage)) return null;

  return (
    <nav className={styles.pagination} aria-label="페이지 이동">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label="이전 페이지"
      >
        {"<"}
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          className={page === currentPage ? styles.pageActive : ""}
          onClick={() => onPageChange(page)}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        aria-label="다음 페이지"
      >
        {">"}
      </button>
    </nav>
  );
}

export function AuthorProfile({ author }: { author: CommunityAuthorDto }) {
  return (
    <div className={styles.profileSummary}>
      <Avatar author={author} size="large" />
      <div className={styles.profileText}>
        {author.diagnosisTypeName ? <span className={styles.typeBadge}>{author.diagnosisTypeName}</span> : null}
        <strong>{author.nickname}</strong>
        <p>{author.statusMessage || "커뮤니티에서 사용하는 상태 메시지를 입력하세요."}</p>
      </div>
    </div>
  );
}

export function Avatar({
  author,
  size = "small",
}: {
  author: Pick<CommunityAuthorDto, "avatarKey" | "backgroundColor">;
  size?: "small" | "large";
}) {
  return (
    <span
      className={styles.avatar}
      style={{ backgroundColor: author.backgroundColor }}
      data-size={size}
    >
      <img src={toProfileAvatarSrc(author.avatarKey)} alt="" />
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

export function DeleteConfirmDialog({
  title,
  description,
  confirmLabel = "삭제하기",
  cancelLabel = "돌아가기",
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className={styles.deleteAlert}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className={styles.deleteAlertActions}>
        <button type="button" className={styles.deleteAlertCancel} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={styles.deleteAlertConfirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </section>
  );
}

export function CommunityQuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? <button type="button" className={styles.quickActionDim} aria-label="메뉴 닫기" onClick={() => setOpen(false)} /> : null}
      <div className={`${styles.quickActionWrap} ${open ? styles.quickActionOpen : ""}`}>
        {open ? (
          <nav className={styles.quickActionMenu} aria-label="커뮤니티 빠른 메뉴">
            <Link href="/community/write">글쓰기</Link>
            <Link href="/community/activity?tab=posts">내가 쓴 글 확인하기</Link>
            <Link href="/community/activity?tab=comments">내가 쓴 댓글 확인하기</Link>
            <Link href="/community/activity?tab=scraps">내가 스크랩한 글 확인하기</Link>
          </nav>
        ) : null}
        <button
          type="button"
          className={styles.floatingWrite}
          aria-label={open ? "커뮤니티 메뉴 닫기" : "커뮤니티 메뉴 열기"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        />
      </div>
    </>
  );
}

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Number.isNaN(date.getTime())) return "";
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < day * 7) return `${Math.floor(diff / day)}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

export function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

export function isCommunityCategory(value: string): value is CommunityCategory {
  return COMMUNITY_CATEGORIES.includes(value as CommunityCategory);
}
