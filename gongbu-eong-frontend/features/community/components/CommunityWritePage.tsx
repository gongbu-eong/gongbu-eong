"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { createCommunityPost, getCommunityPost, updateCommunityPost } from "../community.api";
import { COMMUNITY_CATEGORIES, type CommunityAttachmentDto, type CommunityCategory } from "../community.dto";
import { AuthorProfile } from "./CommunityShared";
import styles from "./Community.module.css";

const MAX_ATTACHMENTS = 20;

type PendingAttachment = Pick<CommunityAttachmentDto, "fileName" | "mimeType" | "fileSizeBytes" | "dataUrl">;

export function CommunityWritePage({ postId }: { postId?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [category, setCategory] = useState<CommunityCategory>("자유·잡담");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
  }, [router]);

  useEffect(() => {
    if (!postId) return;
    getCommunityPost(postId)
      .then((response) => {
        setCategory(response.post.category);
        setTitle(response.post.title);
        setContent(response.post.content);
        setAttachments(response.post.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSizeBytes: attachment.fileSizeBytes,
          dataUrl: attachment.dataUrl,
        })));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."));
  }, [postId]);

  const selectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void readAttachmentFiles(files);
  };

  const dropImage = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void readAttachmentFiles(Array.from(event.dataTransfer.files || []));
  };

  const readAttachmentFiles = async (files: File[]) => {
    if (!files.length) return;
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      window.alert(`첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 등록할 수 있습니다.`);
      return;
    }

    const nextAttachments: PendingAttachment[] = [];
    for (const file of files) {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setMessage("첨부파일은 JPG 또는 PNG만 등록할 수 있습니다.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setMessage("첨부파일은 최대 10MB까지 등록할 수 있습니다.");
        return;
      }

      const dataUrl = await readAsDataUrl(file);
      nextAttachments.push({
        fileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        dataUrl,
      });
    }

    setAttachments((current) => [...current, ...nextAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!title.trim() || !content.trim()) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const response = postId
        ? await updateCommunityPost(postId, { category, title, content, imageDataUrl: attachments[0]?.dataUrl || null, attachments })
        : await createCommunityPost({ category, title, content, imageDataUrl: attachments[0]?.dataUrl || null, attachments });
      router.replace(`/community/${response.post.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시글을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
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
          <h1>{postId ? "글 수정" : "글쓰기"}</h1>
          <AuthorProfile author={author} />
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              카테고리
              <select value={category} onChange={(event) => setCategory(event.target.value as CommunityCategory)}>
                {COMMUNITY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              제목
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="제목을 입력해주세요." />
            </label>
            <label className={styles.field}>
              내용
              <textarea
                value={content}
                maxLength={5000}
                onChange={(event) => setContent(event.target.value)}
                placeholder="운영 원칙 게시물 제재 기준에 위배되는 게시물을 등록 할 경우, 삭제 및 서비스 이용 활동정지 조치를 적용합니다."
              />
            </label>
            {attachments.length ? (
              <div className={styles.attachmentGrid} aria-label="첨부된 이미지">
                {attachments.map((attachment, index) => (
                  <div className={styles.attachmentThumb} key={`${attachment.fileName}-${index}`}>
                    <img src={attachment.dataUrl} alt={attachment.fileName} />
                    <button type="button" onClick={() => removeAttachment(index)} aria-label={`${attachment.fileName} 삭제`}>×</button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className={styles.uploadLabel}>첨부파일</p>
            <label
              className={styles.uploadBox}
              onDragOver={(event) => event.preventDefault()}
              onDrop={dropImage}
            >
              <input type="file" accept="image/png,image/jpeg" multiple onChange={selectImage} />
              <span>
                <span className={styles.uploadIcon}>🎨</span>
                <strong>파일을 선택하거나 여기에 끌어다 놓으세요</strong>
                <small>JPG · PNG (최대 10MB)</small>
              </span>
            </label>
            {message ? <p className={styles.toast}>{message}</p> : null}
            <div className={styles.formActions}>
              <Link href={postId ? `/community/${postId}` : "/community"}>취소</Link>
              <button type="submit" disabled={saving}>{saving ? "저장 중..." : "완료"}</button>
            </div>
          </form>
        </main>
        <AppFooter active="community" />
      </section>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("파일을 읽지 못했습니다."));
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
