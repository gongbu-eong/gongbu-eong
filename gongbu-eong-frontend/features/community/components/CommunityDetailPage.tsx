"use client";

/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import {
  createCommunityComment,
  deleteCommunityComment,
  getCommunityPosts,
  getCommunityPost,
  reportCommunityComment,
  reportCommunityPost,
  setCommunityCommentReaction,
  setCommunityRecommend,
  setCommunityScrap,
} from "../community.api";
import {
  COMMUNITY_SHARE_DESCRIPTION,
  COMMUNITY_SHARE_TITLE,
  getCommunityShareImageUrl,
} from "../community-share";
import type { CommunityCommentDto, CommunityPostDetailDto, CommunityPostSummaryDto } from "../community.dto";
import { Avatar, DeleteConfirmDialog, EmptyState, formatNumber, formatRelativeTime, Pagination, PostItem } from "./CommunityShared";
import styles from "./Community.module.css";

type ModalState =
  | { type: "share" }
  | { type: "report-post" }
  | { type: "report-comment"; commentId: string }
  | { type: "delete-comment"; commentId: string }
  | null;

const REPORT_REASONS = [
  "스팸·홍보/도배",
  "욕설·비방·혐오 표현",
  "음란물·부적절한 콘텐츠",
  "개인정보 노출",
  "허위사실·사기",
  "게시판 성격에 맞지 않음",
  "기타",
];
const COMMENT_PAGE_SIZE = 5;
const BOARD_PAGE_SIZE = 20;

export function CommunityDetailPage({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostDetailDto | null>(null);
  const [comment, setComment] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ commentId: string; nickname: string } | null>(null);
  const [commentPage, setCommentPage] = useState(1);
  const [boardItems, setBoardItems] = useState<CommunityPostSummaryDto[]>([]);
  const [boardTotal, setBoardTotal] = useState(0);
  const [boardPage, setBoardPage] = useState(1);
  const [boardSort, setBoardSort] = useState<"latest" | "popular">("latest");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const loadedPostId = post?.id;

  useEffect(() => {
    getCommunityPost(postId)
      .then((response) => setPost(response.post))
      .catch((error) => setToast(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."));
  }, [postId]);

  useEffect(() => {
    if (!loadedPostId) return;
    let active = true;
    getCommunityPosts({
      sort: boardSort,
      limit: BOARD_PAGE_SIZE,
      offset: (boardPage - 1) * BOARD_PAGE_SIZE,
    })
      .then((response) => {
        if (!active) return;
        setBoardItems(response.items);
        setBoardTotal(response.total);
      })
      .catch((error) => active && setToast(error instanceof Error ? error.message : "게시판 글을 불러오지 못했습니다."));

    return () => {
      active = false;
    };
  }, [boardPage, boardSort, loadedPostId]);

  const toggleRecommend = async () => {
    if (!post) return;
    const previous = post;
    const enabled = !post.isRecommended;
    setPost({
      ...post,
      isRecommended: enabled,
      recommendCount: Math.max(0, post.recommendCount + (enabled ? 1 : -1)),
    });
    try {
      const response = await setCommunityRecommend(post.id, enabled);
      setPost((current) => current ? { ...current, ...response.reaction } : current);
      if (enabled) setToast("추천을 눌러 베스트로 올려주세요!");
    } catch (error) {
      setPost(previous);
      setToast(error instanceof Error ? error.message : "추천 처리에 실패했습니다.");
    }
  };

  const toggleScrap = async () => {
    if (!post) return;
    const previous = post;
    const enabled = !post.isScrapped;
    setPost({
      ...post,
      isScrapped: enabled,
      scrapCount: Math.max(0, post.scrapCount + (enabled ? 1 : -1)),
    });
    try {
      const response = await setCommunityScrap(post.id, enabled);
      setPost((current) => current ? { ...current, ...response.reaction } : current);
    } catch (error) {
      setPost(previous);
      setToast(error instanceof Error ? error.message : "스크랩 처리에 실패했습니다.");
    }
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!post || !comment.trim() || saving) return;
    setSaving(true);
    try {
      const response = await createCommunityComment(post.id, comment);
      setPost(response.post);
      setComment("");
      setCommentPage(1);
      if (response.creditReward?.granted) {
        window.dispatchEvent(new CustomEvent("gongbu-ticket-rewarded", {
          detail: {
            message: "진단권 1장이 추가되었습니다.",
            balanceAfter: response.creditReward.balanceAfter,
          },
        }));
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "댓글 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const startReply = (comment: CommunityCommentDto) => {
    const commentId = comment.id;
    if (replyTarget?.commentId === commentId) {
      setReplyTarget(null);
      setReplyText("");
      return;
    }
    setReplyTarget({
      commentId,
      nickname: comment.author.nickname,
    });
    setReplyText("");
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!post || !replyTarget || !replyText.trim() || saving) return;
    setSaving(true);
    try {
      const response = await createCommunityComment(post.id, replyText, replyTarget.commentId);
      setPost(response.post);
      setReplyTarget(null);
      setReplyText("");
      setCommentPage(1);
      if (response.creditReward?.granted) {
        window.dispatchEvent(new CustomEvent("gongbu-ticket-rewarded", {
          detail: {
            message: "진단권 1장이 추가되었습니다.",
            balanceAfter: response.creditReward.balanceAfter,
          },
        }));
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "답글 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteComment = async (commentId: string) => {
    if (!post) return;
    await deleteCommunityComment(commentId);
    setPost({
      ...post,
      commentCount: Math.max(0, post.commentCount - countRemovedComments(post.comments, commentId)),
      comments: removeCommentById(post.comments, commentId),
    });
    setModal(null);
  };

  const reactComment = async (commentId: string, reactionType: "like" | "dislike") => {
    if (!post) return;
    try {
      const response = await setCommunityCommentReaction(commentId, reactionType);
      setPost((current) => current
        ? { ...current, comments: updateCommentReaction(current.comments, response.reaction) }
        : current);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "댓글 반응 처리에 실패했습니다.");
    }
  };

  const shareWithKakao = async () => {
    if (!post) return;
    const url = window.location.href;
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

    if (!kakaoKey) {
      await navigator.clipboard?.writeText(url);
      setToast("카카오 공유 설정이 없어 링크를 복사했습니다.");
      setModal(null);
      return;
    }

    try {
      await loadKakaoSdk();
      const kakao = window.Kakao;
      if (!kakao) throw new Error("카카오 공유를 준비하지 못했습니다.");
      if (!kakao.isInitialized()) kakao.init(kakaoKey);
      if (!kakao.Share?.sendDefault) throw new Error("카카오 공유를 준비하지 못했습니다.");
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: COMMUNITY_SHARE_TITLE,
          description: COMMUNITY_SHARE_DESCRIPTION,
          imageUrl: getCommunityShareImageUrl(window.location.origin),
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: "글 보러가기", link: { mobileWebUrl: url, webUrl: url } }],
      });
      setModal(null);
    } catch (error) {
      await navigator.clipboard?.writeText(url);
      setToast(error instanceof Error ? `${error.message} 링크를 복사했습니다.` : "카카오 공유에 실패해 링크를 복사했습니다.");
      setModal(null);
    }
  };

  const copyShareLink = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setToast("게시글 링크를 복사했습니다.");
    setModal(null);
  };

  const confirmReport = async () => {
    if (!post || !modal) return;
    try {
      if (modal.type === "report-post") {
        await reportCommunityPost(post.id, selectedReason);
        setToast("신고가 접수되었습니다.");
      }
      if (modal.type === "report-comment") {
        await reportCommunityComment(modal.commentId, selectedReason);
        setToast("댓글 신고가 접수되었습니다.");
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
    } finally {
      setModal(null);
    }
  };

  const totalCommentPages = post ? Math.max(1, Math.ceil(post.comments.length / COMMENT_PAGE_SIZE)) : 1;
  const safeCommentPage = Math.min(commentPage, totalCommentPages);
  const visibleComments = post
    ? post.comments.slice((safeCommentPage - 1) * COMMENT_PAGE_SIZE, safeCommentPage * COMMENT_PAGE_SIZE)
    : [];

  return (
    <div className={styles.page}>
      <section className={styles.frame}>
        <AppHeader />
        <main className={styles.content}>
          {!post ? (
            <EmptyState>{toast || "게시글을 불러오는 중입니다."}</EmptyState>
          ) : (
            <>
              <section className={styles.detailHeader}>
                <h1>글 상세</h1>
                <div className={styles.postMeta}>
                  <span className={styles.categoryBadge}>{post.category}</span>
                  <span>{formatRelativeTime(post.createdAt)}</span>
                </div>
                <strong className={styles.postTitle}>{post.title}</strong>
                <div className={styles.authorLine}>
                  <span>{post.author.nickname}</span>
                  {post.author.diagnosisTypeName ? <b className={styles.typeBadge}>{post.author.diagnosisTypeName}</b> : null}
                  <span>조회수 : {formatNumber(post.viewCount)}</span>
                  <span>추천수 : {formatNumber(post.recommendCount)}</span>
                  <span>댓글 : {formatNumber(post.commentCount)}</span>
                </div>
                {post.canEdit ? (
                  <div className={styles.itemActions}>
                    <Link href={`/community/${post.id}/edit`}>글 수정</Link>
                    <button type="button" onClick={() => router.push("/community/activity")}>내 활동</button>
                  </div>
                ) : null}
              </section>
              <article className={styles.detailBody}>
                {post.content}
                {post.attachments.map((attachment) => attachment.mimeType.startsWith("image/") ? (
                  <img key={attachment.id} src={attachment.dataUrl} className={styles.detailImage} alt={attachment.fileName} />
                ) : null)}
              </article>
              <div className={styles.actionRow}>
                <button type="button" className={post.isRecommended ? styles.actionActive : ""} onClick={toggleRecommend}>
                  <Image src={post.isRecommended ? "/community/heart-filled.svg" : "/community/heart-outline.svg"} alt="" width={24} height={24} />
                   {formatNumber(post.recommendCount)}
                </button>
                <button type="button" className={post.isScrapped ? styles.actionActive : ""} onClick={toggleScrap}>
                  <Image src={post.isScrapped ? "/community/bookmark-filled.svg" : "/community/bookmark-outline.svg"} alt="" width={24} height={24} />
                  스크랩
                </button>
                <button type="button" onClick={() => setModal({ type: "share" })}>
                  <Image src="/community/share.svg" alt="" width={24} height={24} />
                  공유
                </button>
                <button type="button" onClick={() => setModal({ type: "report-post" })}>
                  <Image src="/community/report.svg" alt="" width={24} height={24} />
                  신고
                </button>
              </div>
              {toast ? (
                <div className={styles.toast}>
                  <span>{toast}</span>
                  <button type="button" onClick={() => setToast("")}>
                    <Image src="/community/close.svg" alt="" width={14} height={14} />
                  </button>
                </div>
              ) : null}
              <section className={styles.commentSection}>
                <h2>댓글 {formatNumber(post.commentCount)}</h2>
                <form className={styles.commentForm} onSubmit={submitComment}>
                  <textarea value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요." />
                  <button type="submit" disabled={!comment.trim() || saving}>등록</button>
                </form>
                <div className={styles.commentList}>
                  {visibleComments.map((item) => (
                    <CommunityComment
                      key={item.id}
                      comment={item}
                      replyTarget={replyTarget}
                      replyText={replyText}
                      saving={saving}
                      onReplyTextChange={setReplyText}
                      onReply={startReply}
                      onSubmitReply={submitReply}
                      onReport={() => setModal({ type: "report-comment", commentId: item.id })}
                      onDelete={() => setModal({ type: "delete-comment", commentId: item.id })}
                      onReportReply={(commentId) => setModal({ type: "report-comment", commentId })}
                      onDeleteReply={(commentId) => setModal({ type: "delete-comment", commentId })}
                      onReact={reactComment}
                    />
                  ))}
                  {!post.comments.length ? <EmptyState>아직 댓글이 없습니다.</EmptyState> : null}
                </div>
                <Pagination
                  currentPage={safeCommentPage}
                  totalItems={post.comments.length}
                  pageSize={COMMENT_PAGE_SIZE}
                  onPageChange={setCommentPage}
                  showSinglePage
                />
                <Link href="/community" className={styles.backToListButton}>
                  목록으로 가기
                </Link>
              </section>
              <section className={styles.detailBoardSection}>
                <div className={`${styles.sectionHeader} ${styles.allPostsHeader}`}>
                  <h2>전체 글</h2>
                  <div className={styles.sortButtons}>
                    <button
                      className={boardSort === "latest" ? styles.sortActive : ""}
                      onClick={() => {
                        setBoardSort("latest");
                        setBoardPage(1);
                      }}
                    >
                      최신순
                    </button>
                    <span>|</span>
                    <button
                      className={boardSort === "popular" ? styles.sortActive : ""}
                      onClick={() => {
                        setBoardSort("popular");
                        setBoardPage(1);
                      }}
                    >
                      인기순
                    </button>
                  </div>
                </div>
                <div className={styles.postList}>
                  {boardItems.map((item) => <PostItem key={item.id} post={item} />)}
                  {!boardItems.length ? <EmptyState>이 게시판에 등록된 글이 없습니다.</EmptyState> : null}
                </div>
                <Pagination
                  currentPage={boardPage}
                  totalItems={boardTotal}
                  pageSize={BOARD_PAGE_SIZE}
                  onPageChange={setBoardPage}
                  showSinglePage
                />
              </section>
            </>
          )}
        </main>
        <AppFooter active="community" />
      </section>
      {modal ? (
        <div
          className={`${styles.modalBackdrop} ${modal.type === "delete-comment" ? "" : styles.sheetBackdrop}`}
          role="dialog"
          aria-modal="true"
        >
          {modal.type === "delete-comment" ? (
            <DeleteConfirmDialog
              title="댓글을 삭제하시겠습니까?"
              description="댓글을 삭제하면, 복구가 되지 않습니다."
              onCancel={() => setModal(null)}
              onConfirm={() => void confirmDeleteComment(modal.commentId)}
            />
          ) : modal.type === "share" ? (
            <section className={`${styles.bottomSheet} ${styles.shareSheet}`}>
              <span className={styles.sheetHandle} />
              <h2>공유하기</h2>
              <div className={styles.shareActions}>
                <button type="button" onClick={() => void shareWithKakao()}>
                  <span className={styles.shareIconCircle}>
                    <Image src="/community/kakao.png" alt="" width={42} height={42} />
                  </span>
                  카카오톡
                </button>
                <button type="button" onClick={() => void copyShareLink()}>
                  <span className={styles.shareIconCircle}>
                    <Image src="/community/link.svg" alt="" width={32} height={32} />
                  </span>
                  링크
                </button>
              </div>
              <button type="button" className={styles.sheetCancel} onClick={() => setModal(null)}>취소</button>
            </section>
          ) : (
            <section className={`${styles.bottomSheet} ${styles.reportSheet}`}>
              <span className={styles.sheetHandle} />
              <h2>{modal.type === "report-comment" ? "댓글 신고하기" : "이 글 신고하기"}</h2>
              <p>신고 사유를 선택해 주세요. 신고 내용은 운영팀이 검토합니다.</p>
              <div className={styles.reportReasons}>
                {REPORT_REASONS.map((reason) => (
                  <label key={reason}>
                    <input
                      type="radio"
                      name="reportReason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              <div className={styles.sheetActions}>
                <button type="button" className={styles.sheetCancel} onClick={() => setModal(null)}>취소</button>
                <button type="button" className={styles.sheetSubmit} onClick={() => void confirmReport()}>신고 제출</button>
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share?: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

function loadKakaoSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.Kakao) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-sdk]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("카카오 SDK를 불러오지 못했습니다.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
    script.async = true;
    script.dataset.kakaoSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("카카오 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

function CommunityComment({
  comment,
  depth = 0,
  replyTarget,
  replyText,
  saving,
  onReplyTextChange,
  onReply,
  onSubmitReply,
  onReport,
  onDelete,
  onReportReply,
  onDeleteReply,
  onReact,
}: {
  comment: CommunityCommentDto;
  depth?: number;
  replyTarget: { commentId: string; nickname: string } | null;
  replyText: string;
  saving: boolean;
  onReplyTextChange: (value: string) => void;
  onReply: (comment: CommunityCommentDto) => void;
  onSubmitReply: (event: FormEvent) => void;
  onReport: () => void;
  onDelete: () => void;
  onReportReply: (commentId: string) => void;
  onDeleteReply: (commentId: string) => void;
  onReact: (commentId: string, reactionType: "like" | "dislike") => void;
}) {
  const isReply = depth > 0;


  return (
    <article className={isReply ? styles.replyComment : styles.comment}>
      <div className={styles.commentHeader}>
        {isReply ? <Image src="/community/reply-arrow.svg" alt="" width={24} height={24} /> : <Avatar author={comment.author} />}
        <div className={styles.authorLine}>
          <strong>{comment.author.nickname}</strong>
          {comment.author.diagnosisTypeName ? <b className={styles.typeBadge}>{comment.author.diagnosisTypeName}</b> : null}
        </div>
        <time>{formatCommentDate(comment.createdAt)}</time>
      </div>
      <p className={styles.commentBody}>{comment.content}</p>
      <CommentActions
        likeCount={comment.likeCount}
        dislikeCount={comment.dislikeCount}
        myReaction={comment.myReaction}
        onReply={() => onReply(comment)}
        onReact={(reactionType) => onReact(comment.id, reactionType)}
        onReport={onReport}
        onDelete={comment.canDelete ? onDelete : undefined}
      />
      {replyTarget?.commentId === comment.id ? (
        <ReplyForm
          replyText={replyText}
          saving={saving}
          placeholder="댓글을 입력하세요."
          onReplyTextChange={onReplyTextChange}
          onSubmitReply={onSubmitReply}
        />
      ) : null}
      {comment.replies.length ? (
        <div className={styles.replyList}>
          {comment.replies.map((reply) => (
            <CommunityComment
              key={reply.id}
              comment={reply}
              depth={1}
              replyTarget={replyTarget}
              replyText={replyText}
              saving={saving}
              onReplyTextChange={onReplyTextChange}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
              onReport={() => onReportReply(reply.id)}
              onDelete={() => onDeleteReply(reply.id)}
              onReportReply={onReportReply}
              onDeleteReply={onDeleteReply}
              onReact={onReact}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ReplyForm({
  replyText,
  saving,
  placeholder,
  onReplyTextChange,
  onSubmitReply,
}: {
  replyText: string;
  saving: boolean;
  placeholder: string;
  onReplyTextChange: (value: string) => void;
  onSubmitReply: (event: FormEvent) => void;
}) {
  return (
    <form className={styles.replyForm} onSubmit={onSubmitReply}>
      <Image src="/community/reply-arrow.svg" alt="" width={24} height={24} />
      <textarea
        value={replyText}
        maxLength={500}
        onChange={(event) => onReplyTextChange(event.target.value)}
        placeholder={placeholder}
      />
      <button type="submit" disabled={!replyText.trim() || saving}>등록</button>
    </form>
  );
}

function CommentActions({
  compact = false,
  likeCount,
  dislikeCount,
  myReaction,
  onReply,
  onReact,
  onReport,
  onDelete,
}: {
  compact?: boolean;
  likeCount: number;
  dislikeCount: number;
  myReaction: "like" | "dislike" | null;
  onReply: () => void;
  onReact: (reactionType: "like" | "dislike") => void;
  onReport: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`${styles.commentTools} ${compact ? styles.commentToolsCompact : ""}`}>
      {!compact ? <button type="button" className={styles.replyWriteButton} onClick={onReply}>답글 쓰기</button> : null}
      <div className={styles.commentReactionGroup}>
        <button
          type="button"
          className={myReaction === "like" ? styles.commentReactionActive : ""}
          aria-label="댓글 좋아요"
          onClick={() => onReact("like")}
        >
          <Image src="/community/comment-like.svg" alt="" width={24} height={24} />
          <span>{formatNumber(likeCount)}</span>
        </button>
        <span className={styles.commentDivider} />
        <button
          type="button"
          className={myReaction === "dislike" ? styles.commentReactionActive : ""}
          aria-label="댓글 싫어요"
          onClick={() => onReact("dislike")}
        >
          <Image className={styles.dislikeIcon} src="/community/comment-like.svg" alt="" width={24} height={24} />
          <span>{formatNumber(dislikeCount)}</span>
        </button>
        <span className={styles.commentDivider} />
        <button type="button" onClick={onReport}>
          <Image src="/community/comment-report.svg" alt="" width={24} height={24} />
          <span>신고</span>
        </button>
        {onDelete ? (
          <>
            <span className={styles.commentDivider} />
            <button type="button" onClick={onDelete}>
              <span>삭제</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function removeCommentById(comments: CommunityCommentDto[], commentId: string): CommunityCommentDto[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: removeCommentById(comment.replies, commentId),
    }));
}

function countRemovedComments(comments: CommunityCommentDto[], commentId: string): number {
  for (const comment of comments) {
    if (comment.id === commentId) return countCommentTree(comment);
    const nestedCount = countRemovedComments(comment.replies, commentId);
    if (nestedCount) return nestedCount;
  }

  return 0;
}

function countCommentTree(comment: CommunityCommentDto): number {
  return 1 + comment.replies.reduce((total, reply) => total + countCommentTree(reply), 0);
}

function updateCommentReaction(
  comments: CommunityCommentDto[],
  reaction: { commentId: string; likeCount: number; dislikeCount: number; myReaction: "like" | "dislike" | null },
): CommunityCommentDto[] {
  return comments.map((comment) => {
    if (comment.id === reaction.commentId) {
      return {
        ...comment,
        likeCount: reaction.likeCount,
        dislikeCount: reaction.dislikeCount,
        myReaction: reaction.myReaction,
      };
    }

    return {
      ...comment,
      replies: updateCommentReaction(comment.replies, reaction),
    };
  });
}
