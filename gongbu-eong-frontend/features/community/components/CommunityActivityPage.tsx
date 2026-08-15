"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { deleteCommunityComment, deleteCommunityPost, getCommunityActivity, setCommunityScrap } from "../community.api";
import type { CommunityActivityResponseDto } from "../community.dto";
import { AuthorProfile, EmptyState, PostItem, formatRelativeTime } from "./CommunityShared";
import styles from "./Community.module.css";

type ActivityTab = "posts" | "comments" | "scraps";
type ConfirmState =
  | { type: "post"; id: string }
  | { type: "comment"; id: string }
  | { type: "scrap"; id: string }
  | null;

export function CommunityActivityPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [activity, setActivity] = useState<CommunityActivityResponseDto | null>(null);
  const [tab, setTab] = useState<ActivityTab>(() => (
    typeof window === "undefined"
      ? "posts"
      : toActivityTab(new URLSearchParams(window.location.search).get("tab"))
  ));
  const [message, setMessage] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<ConfirmState>(null);

  useEffect(() => {
    getCurrentUser()
      .then((response) => {
        if (!response.authenticated || !response.user) {
          router.replace("/login");
          return;
        }
        setUser(response.user);
      })
      .catch(() => router.replace("/login"));
    getCommunityActivity()
      .then(setActivity)
      .catch((error) => setMessage(error instanceof Error ? error.message : "내 활동을 불러오지 못했습니다."));
  }, [router]);

  const confirmAction = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === "post") {
      await deleteCommunityPost(confirmTarget.id);
      setActivity((current) => current ? { ...current, posts: current.posts.filter((item) => item.id !== confirmTarget.id) } : current);
    }
    if (confirmTarget.type === "comment") {
      await deleteCommunityComment(confirmTarget.id);
      setActivity((current) => current ? { ...current, comments: current.comments.filter((item) => item.id !== confirmTarget.id) } : current);
    }
    if (confirmTarget.type === "scrap") {
      await setCommunityScrap(confirmTarget.id, false);
      setActivity((current) => current ? { ...current, scraps: current.scraps.filter((item) => item.id !== confirmTarget.id) } : current);
    }
    setConfirmTarget(null);
  };

  const author = {
    id: user?.id || "",
    nickname: user?.communityNickname || "커뮤니티 닉네임",
    statusMessage: user?.profileStatusMessage ?? null,
    avatarKey: user?.profileAvatarKey || "fox",
    backgroundColor: user?.profileBackgroundColor || "#c4c6ca",
    diagnosisTypeName: user?.diagnosisTypeName ?? null,
  };

  return (
    <div className={styles.page}>
      <section className={styles.frame}>
        <AppHeader user={user} />
        <main className={styles.content}>
          <h1>내 활동</h1>
          <AuthorProfile author={author} />
          <nav className={styles.activityTabs}>
            <button className={tab === "posts" ? styles.tabActive : ""} onClick={() => setTab("posts")}>작성글 ({activity?.posts.length || 0})</button>
            <button className={tab === "comments" ? styles.tabActive : ""} onClick={() => setTab("comments")}>작성 댓글 ({activity?.comments.length || 0})</button>
            <button className={tab === "scraps" ? styles.tabActive : ""} onClick={() => setTab("scraps")}>스크랩({activity?.scraps.length || 0})</button>
          </nav>
          {message ? <p className={styles.toast}>{message}</p> : null}
          <section className={styles.activitySection}>
            {tab === "posts" ? (
              <div className={styles.activityList}>
                {activity?.posts.map((post) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    actions={
                      <span className={styles.itemActions} onClick={(event) => event.preventDefault()}>
                        <Link href={`/community/${post.id}/edit`}>글 수정</Link>
                        <button type="button" onClick={() => setConfirmTarget({ type: "post", id: post.id })}>글 삭제</button>
                      </span>
                    }
                  />
                ))}
                {activity && !activity.posts.length ? <EmptyState>작성한 글이 없습니다.</EmptyState> : null}
              </div>
            ) : null}
            {tab === "comments" ? (
              <div className={styles.activityList}>
                {activity?.comments.map((comment) => (
                  <article key={comment.id} className={styles.postItem}>
                    <Link href={`/community/${comment.postId}`} className={styles.postItemMain}>
                      <div className={styles.postMeta}>
                        <span className={styles.categoryBadge}>댓글</span>
                        <span>{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <strong className={styles.postTitle}>{comment.content}</strong>
                    </Link>
                    <span className={styles.itemActions}>
                      <button type="button" onClick={() => setConfirmTarget({ type: "comment", id: comment.id })}>댓글 삭제</button>
                    </span>
                  </article>
                ))}
                {activity && !activity.comments.length ? <EmptyState>작성한 댓글이 없습니다.</EmptyState> : null}
              </div>
            ) : null}
            {tab === "scraps" ? (
              <div className={styles.activityList}>
                {activity?.scraps.map((post) => (
                  <PostItem
                    key={post.id}
                    post={post}
                    actions={
                      <span className={styles.itemActions} onClick={(event) => event.preventDefault()}>
                        <button type="button" onClick={() => setConfirmTarget({ type: "scrap", id: post.id })}>스크랩 해제</button>
                      </span>
                    }
                  />
                ))}
                {activity && !activity.scraps.length ? <EmptyState>스크랩한 글이 없습니다.</EmptyState> : null}
              </div>
            ) : null}
          </section>
        </main>
        <AppFooter active="community" />
      </section>
      {confirmTarget ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <section className={styles.modal}>
            <h2>{getConfirmTitle(confirmTarget)}</h2>
            <p>{getConfirmDescription(confirmTarget)}</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setConfirmTarget(null)}>취소</button>
              <button type="button" className={styles.primaryButton} onClick={() => void confirmAction()}>확인</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function toActivityTab(value: string | null): ActivityTab {
  return value === "comments" || value === "scraps" ? value : "posts";
}

function getConfirmTitle(target: Exclude<ConfirmState, null>) {
  if (target.type === "post") return "글을 삭제하시겠습니까?";
  if (target.type === "comment") return "댓글을 삭제하시겠습니까?";
  return "스크랩을 해제하시겠습니까?";
}

function getConfirmDescription(target: Exclude<ConfirmState, null>) {
  if (target.type === "post") return "삭제한 글은 내 활동에서 다시 확인할 수 없습니다.";
  if (target.type === "comment") return "삭제한 댓글은 다시 복구할 수 없습니다.";
  return "해제하면 스크랩한 글 목록에서 사라집니다.";
}
