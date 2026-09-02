"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { deleteResume, listResumes, selectResume } from "../my.api";
import type { ResumeDto } from "../my.dto";
import styles from "./My.module.css";

export function MyResumeList() {
  const [resumes, setResumes] = useState<ResumeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<ResumeDto | null>(null);
  useBodyScrollLock(Boolean(deleting));

  const refresh = () => {
    setLoading(true);
    listResumes()
      .then((response) => setResumes(response.resumes))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;

    listResumes()
      .then((response) => {
        if (alive) setResumes(response.resumes);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteResume(deleting.id);
      setDeleting(null);
      refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "이력서 삭제에 실패했습니다.");
    }
  };

  const handleSelect = async (resumeId: string) => {
    await selectResume(resumeId);
    refresh();
  };

  return (
    <div className={`${styles.page} ${styles.resumeListPage}`}>
      <AppHeader />
      <main className={`${styles.frame} ${styles.resumeListFrame}`}>
        <h1 className={styles.title}>내 이력서 관리</h1>
        <p className={styles.subtitle}>이력서를 채워두면 AI 도구 분석에 유용합니다.</p>

        {!loading && resumes.length === 0 ? (
          <div className={styles.emptyBox}>
            <strong>등록된 이력서가 없습니다.</strong>
            <Link href="/my/resumes/new">+ 등록하기</Link>
          </div>
        ) : null}

        {resumes.length > 0 ? (
          <>
            <div className={styles.resumeList}>
              {resumes.map((resume) => (
                <article key={resume.id} className={styles.resumeCard}>
                  <strong className={styles.resumeTitle}>{formatText(resume.title) || "이력서"}</strong>
                  <time className={styles.resumeDate}>{formatDate(resume.createdAt)}</time>
                  {resume.isSelected ? <span className={styles.selectedMark}>✓ 선택됨</span> : null}
                  <div className={styles.cardActions}>
                    <Link href={`/my/resumes/${resume.id}/edit`} className={styles.smallButton}>
                      수정
                    </Link>
                    <button type="button" className={styles.smallButton} onClick={() => setDeleting(resume)}>
                      삭제
                    </button>
                    <Link href={`/my/resumes/${resume.id}`} className={styles.smallButton}>
                      이력서 보기
                    </Link>
                    {!resume.isSelected ? (
                      <button type="button" className={styles.smallButton} onClick={() => handleSelect(resume.id)}>
                        선택하기
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <Link href="/my/resumes/new" className={`${styles.secondaryButton} ${styles.addButton}`}>
              + 이력서 추가하기
            </Link>
          </>
        ) : null}
      </main>
      <AppFooter active="my" />

      {deleting ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h2>이력서를 삭제하시겠습니까?</h2>
            <p>이력서를 삭제하면, 복구가 되지 않습니다.</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} onClick={() => setDeleting(null)}>
                돌아가기
              </button>
              <button type="button" className={styles.dangerButton} onClick={handleDelete}>
                삭제하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function formatText(value?: string | null) {
  const next = value?.trim();
  if (!next || /^(null|undefined)$/i.test(next)) return "";
  return next;
}
