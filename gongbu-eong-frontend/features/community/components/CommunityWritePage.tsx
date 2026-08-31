"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { createCommunityPost, getCommunityPost, updateCommunityPost } from "../community.api";
import { COMMUNITY_CATEGORIES, type CommunityAttachmentDto, type CommunityCategory } from "../community.dto";
import { AuthorProfile } from "./CommunityShared";
import styles from "./Community.module.css";

const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_DATA_URL_LENGTH = 12_000_000;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

type PendingAttachment = Pick<CommunityAttachmentDto, "fileName" | "mimeType" | "fileSizeBytes" | "dataUrl">;
type FormSnapshot = {
  category: CommunityCategory;
  title: string;
  content: string;
  attachments: string[];
};

export function CommunityWritePage({ postId }: { postId?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [category, setCategory] = useState<CommunityCategory>("자유·잡담");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [originalForm, setOriginalForm] = useState<FormSnapshot | null>(
    postId ? null : createFormSnapshot("자유·잡담", "", "", []),
  );
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
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  useEffect(() => {
    if (!postId) return;
    getCommunityPost(postId)
      .then((response) => {
        const nextAttachments = response.post.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSizeBytes: attachment.fileSizeBytes,
          dataUrl: attachment.dataUrl,
        }));
        setCategory(response.post.category);
        setTitle(response.post.title);
        setContent(response.post.content);
        setAttachments(nextAttachments);
        setOriginalForm(createFormSnapshot(
          response.post.category,
          response.post.title,
          response.post.content,
          nextAttachments,
        ));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."));
  }, [postId]);

  const currentForm = useMemo(
    () => createFormSnapshot(category, title, content, attachments),
    [attachments, category, content, title],
  );
  const hasChanges = originalForm ? !isSameFormSnapshot(originalForm, currentForm) : !postId;
  const canSubmit = Boolean(title.trim() && content.trim()) && (!postId || hasChanges);

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

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setMessage("첨부파일은 최대 10MB까지 등록할 수 있습니다.");
        return;
      }

      try {
        nextAttachments.push(await normalizeImageAttachment(file));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "첨부파일을 처리하지 못했습니다.");
        return;
      }
    }

    const totalDataUrlLength = [...attachments, ...nextAttachments].reduce(
      (total, attachment) => total + attachment.dataUrl.length,
      0,
    );
    if (totalDataUrlLength > MAX_TOTAL_ATTACHMENT_DATA_URL_LENGTH) {
      setMessage("첨부파일 총 용량이 너무 큽니다. 이미지를 줄여 다시 첨부해 주세요.");
      return;
    }

    setAttachments((current) => [...current, ...nextAttachments]);
    setMessage("");
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
    const totalDataUrlLength = attachments.reduce((total, attachment) => total + attachment.dataUrl.length, 0);
    if (totalDataUrlLength > MAX_TOTAL_ATTACHMENT_DATA_URL_LENGTH) {
      setMessage("첨부파일 총 용량이 너무 큽니다. 이미지를 줄여 다시 첨부해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const response = postId
        ? await updateCommunityPost(postId, { category, title, content, imageDataUrl: attachments[0]?.dataUrl || null, attachments })
        : await createCommunityPost({ category, title, content, imageDataUrl: attachments[0]?.dataUrl || null, attachments });
      if (response.creditReward?.granted) {
        window.sessionStorage.setItem("gongbu_pending_ticket_reward", JSON.stringify({
          message: "진단권 1장이 추가되었습니다.",
          balanceAfter: response.creditReward.balanceAfter,
          progress: response.creditReward.progress,
        }));
        window.dispatchEvent(new CustomEvent("gongbu-ticket-rewarded", {
          detail: {
            message: "진단권 1장이 추가되었습니다.",
            balanceAfter: response.creditReward.balanceAfter,
            progress: response.creditReward.progress,
          },
        }));
      } else if (response.creditReward?.progress) {
        window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
          detail: {
            balanceAfter: response.creditReward.balanceAfter,
            progress: response.creditReward.progress,
          },
        }));
      }
      router.replace(postId ? `/community/${response.post.id}` : "/community");
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
        <main className={`${styles.content} ${styles.writeContent}`}>
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
                <span className={styles.uploadIcon} aria-hidden="true">🎨</span>
                <strong>파일을 선택하거나 여기에 끌어다 놓으세요</strong>
                <small>JPG · PNG (최대 10MB)</small>
              </span>
            </label>
            {message ? <p className={styles.toast}>{message}</p> : null}
            <div className={styles.formActions}>
              <Link href={postId ? `/community/${postId}` : "/community"}>취소</Link>
              <button type="submit" disabled={saving || !canSubmit}>{saving ? "저장 중..." : postId ? "수정 완료" : "완료"}</button>
            </div>
          </form>
        </main>
        <AppFooter active="community" />
      </section>
    </div>
  );
}

function createFormSnapshot(
  category: CommunityCategory,
  title: string,
  content: string,
  attachments: PendingAttachment[],
): FormSnapshot {
  return {
    category,
    title,
    content,
    attachments: attachments.map((attachment) => [
      attachment.fileName,
      attachment.mimeType,
      attachment.fileSizeBytes,
      attachment.dataUrl,
    ].join("\u001f")),
  };
}

function isSameFormSnapshot(left: FormSnapshot, right: FormSnapshot) {
  return (
    left.category === right.category &&
    left.title === right.title &&
    left.content === right.content &&
    left.attachments.length === right.attachments.length &&
    left.attachments.every((value, index) => value === right.attachments[index])
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

async function normalizeImageAttachment(file: File): Promise<PendingAttachment> {
  const originalDataUrl = await readAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("첨부파일을 처리하지 못했습니다.");
  }

  context.drawImage(image, 0, 0, width, height);
  const compressedDataUrl = canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
  const shouldUseCompressed =
    compressedDataUrl.length < originalDataUrl.length ||
    originalDataUrl.length > MAX_TOTAL_ATTACHMENT_DATA_URL_LENGTH / MAX_ATTACHMENTS;
  const dataUrl = shouldUseCompressed ? compressedDataUrl : originalDataUrl;
  const mimeType = dataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : file.type;

  return {
    fileName: mimeType === "image/jpeg" ? toJpegFileName(file.name) : file.name,
    mimeType,
    fileSizeBytes: estimateDataUrlBytes(dataUrl),
    dataUrl,
  };
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("첨부파일을 이미지로 읽지 못했습니다."));
    image.src = dataUrl;
  });
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

function toJpegFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "첨부 이미지"}.jpg`;
}
