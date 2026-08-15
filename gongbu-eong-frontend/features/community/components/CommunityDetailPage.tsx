"use client";

/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import {
  createCommunityComment,
  deleteCommunityComment,
  getCommunityPost,
  reportCommunityComment,
  reportCommunityPost,
  setCommunityRecommend,
  setCommunityScrap,
} from "../community.api";
import type { CommunityCommentDto, CommunityPostDetailDto } from "../community.dto";
import { Avatar, EmptyState, formatNumber, formatRelativeTime } from "./CommunityShared";
import styles from "./Community.module.css";

type ModalState =
  | { type: "share" }
  | { type: "report-post" }
  | { type: "report-comment"; commentId: string }
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

export function CommunityDetailPage({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostDetailDto | null>(null);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCommunityPost(postId)
      .then((response) => setPost(response.post))
      .catch((error) => setToast(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."));
  }, [postId]);

  const toggleRecommend = async () => {
    if (!post) return;
    try {
      const response = await setCommunityRecommend(post.id, !post.isRecommended);
      setPost(response.post);
      if (!post.isRecommended) setToast("추천을 눌러 베스트로 올려주세요!");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "추천 처리에 실패했습니다.");
    }
  };

  const toggleScrap = async () => {
    if (!post) return;
    try {
      const response = await setCommunityScrap(post.id, !post.isScrapped);
      setPost(response.post);
    } catch (error) {
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
    } catch (error) {
      setToast(error instanceof Error ? error.message : "댓글 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!post || !confirm("댓글을 삭제하시겠습니까?")) return;
    await deleteCommunityComment(commentId);
    setPost({ ...post, comments: post.comments.filter((item) => item.id !== commentId) });
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

    await loadKakaoSdk();
    const kakao = window.Kakao;
    if (!kakao) throw new Error("카카오 공유를 준비하지 못했습니다.");
    if (!kakao.isInitialized()) kakao.init(kakaoKey);
    kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: post.title,
        description: post.contentPreview,
        imageUrl: post.imageUrl || `${window.location.origin}/home/home-hero-diagnosis-required.png`,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: "글 보러가기", link: { mobileWebUrl: url, webUrl: url } }],
    });
    setModal(null);
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
                <h2>댓글 {post.comments.length}</h2>
                <form className={styles.commentForm} onSubmit={submitComment}>
                  <textarea value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요." />
                  <button type="submit" disabled={!comment.trim() || saving}>등록</button>
                </form>
                <div className={styles.commentList}>
                  {post.comments.map((item) => (
                    <CommunityComment
                      key={item.id}
                      comment={item}
                      onReport={() => setModal({ type: "report-comment", commentId: item.id })}
                      onDelete={() => void deleteComment(item.id)}
                    />
                  ))}
                  {!post.comments.length ? <EmptyState>아직 댓글이 없습니다.</EmptyState> : null}
                </div>
              </section>
            </>
          )}
        </main>
        <AppFooter active="community" />
      </section>
      {modal ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          {modal.type === "share" ? (
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
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: unknown) => void;
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
  onReport,
  onDelete,
}: {
  comment: CommunityCommentDto;
  onReport: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={styles.comment}>
      <Avatar author={comment.author} />
      <div>
        <div className={styles.authorLine}>
          <strong>{comment.author.nickname}</strong>
          {comment.author.diagnosisTypeName ? <b className={styles.typeBadge}>{comment.author.diagnosisTypeName}</b> : null}
          <span>{formatRelativeTime(comment.createdAt)}</span>
        </div>
        <p>{comment.content}</p>
        <div className={styles.commentTools}>
          <button type="button" onClick={onReport}>신고</button>
          {comment.canDelete ? <button type="button" onClick={onDelete}>삭제</button> : null}
        </div>
      </div>
    </article>
  );
}
