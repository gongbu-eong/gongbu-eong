"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  getCurrentUser,
  getJobPosting,
  setJobBookmark,
} from "@/features/home/home.api";
import type { JobPostingDetailDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import styles from "./JobDetail.module.css";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobPostingDetailDto | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getJobPosting(jobId), getCurrentUser()])
      .then(([posting, session]) => {
        if (!mounted) return;
        setJob(posting);
        setAuthenticated(session.authenticated);
      })
      .catch((error) => {
        if (mounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "공고 정보를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [jobId]);

  const toggleBookmark = async () => {
    if (!job) return;
    if (!authenticated) {
      setMessage("찜한 공고를 저장하려면 로그인이 필요합니다.");
      return;
    }
    setBookmarkPending(true);
    try {
      const result = await setJobBookmark(job.id, !job.isBookmarked);
      setJob({ ...job, isBookmarked: result.isBookmarked });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "찜 상태를 바꾸지 못했습니다.",
      );
    } finally {
      setBookmarkPending(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        <AppHeader />
        <div className={styles.titleRow}>
          <h1>공고정보</h1>
        </div>

        {loading ? <p className={styles.state}>공고 정보를 불러오고 있어요.</p> : null}
        {!loading && message && !job ? (
          <div className={styles.error}>
            <strong>공고를 확인할 수 없어요.</strong>
            <p>{message}</p>
            <Link href="/jobs">목록으로 돌아가기</Link>
          </div>
        ) : null}

        {job ? (
          <>
            <article className={styles.content}>
              <section className={styles.summary}>
                <span className={getDdayBadgeClass(job)}>
                  {job.isClosed ? "마감" : job.dday}
                </span>
                <small>{job.institutionName}</small>
                <h2>{job.title}</h2>
                <button
                  type="button"
                  className={`${styles.bookmark} ${job.isBookmarked ? styles.bookmarked : ""}`}
                  aria-label={job.isBookmarked ? "찜 해제" : "찜하기"}
                  disabled={bookmarkPending}
                  onClick={() => void toggleBookmark()}
                >
                  <StarIcon filled={job.isBookmarked} />
                </button>
              </section>

              <section className={styles.factGrid}>
                <Fact label="채용인원" value={toHiringCount(job.hiringCount)} />
                <Fact label="고용형태" value={job.employmentType || "정보 없음"} />
                <Fact label="접수 기간" value={toCompactPeriod(job.applicationStartAt, job.applicationEndAt)} />
                <Fact label="근무지" value={job.region || "정보 없음"} />
              </section>

              <div className={getDeadlineNoticeClass(job)}>
                <strong>{job.isClosed ? "이 공고는 접수가 마감되었어요" : `지금 접수 중이에요! ${toRemainingText(job.applicationEndAt)}`}</strong>
                <span>{job.isClosed ? `(${toCompactPeriod(job.applicationStartAt, job.applicationEndAt)})` : toDeadlineDetail(job.applicationEndAt)}</span>
              </div>

              <DetailSection title="기본 정보" icon="📋">
                <InfoRow label="표준직무(NCS)" value={job.ncsCategory || job.categories.join(" · ") || job.jobCategory} />
                <InfoRow label="학력정보" value={job.educationRequirement} />
                <InfoRow label="채용구분" value={job.careerRequirement} />
                <InfoRow label="고용형태" value={job.employmentType} />
                <InfoRow label="대체인력" value={extractBasicValue(job.basicInfo, "대체인력")} />
                <InfoRow label="근무지역" value={job.region} />
                <InfoRow label="채용인원" value={toHiringCount(job.hiringCount)} />
                <InfoRow label="우대조건" value={job.preference} />
                <InfoRow label="채용기간" value={toCompactPeriod(job.applicationStartAt, job.applicationEndAt)} />
                <InfoRow label="등록일" value={toDate(job.announcementAt)} />
              </DetailSection>

              <DetailSection title="응시자격" icon="✅">
                <RichText value={job.qualification} empty="등록된 지원 자격 정보가 없습니다." />
              </DetailSection>

              {job.disqualification ? (
                <DetailSection title="결격사유" icon="🚫">
                  <RichText value={job.disqualification} />
                </DetailSection>
              ) : null}

              <DetailSection title="우대내용" icon="⭐">
                <RichText value={job.preference} empty="등록된 우대 조건이 없습니다." />
              </DetailSection>

              <DetailSection title="전형절차 / 방법" icon="⭐">
                <RichText
                  value={[job.applicationMethod, job.screeningProcess, job.requiredDocuments].filter(Boolean).join("\n\n")}
                  empty="등록된 전형 정보가 없습니다."
                />
              </DetailSection>

              {job.files.length ? (
                <DetailSection title="첨부파일" icon="📎">
                  <div className={styles.files}>
                    {job.files.map((file) => (
                      <a key={file.id} href={`${backendUrl}/api/jobs/files/${file.id}`}>
                        <span className={styles.fileBadge}>{getFileBadge(file.fileType, file.fileName)}</span>
                        <span>{file.fileName}</span>
                        <DownloadIcon />
                      </a>
                    ))}
                  </div>
                </DetailSection>
              ) : null}

              {job.additionalNotice ? <RichText value={job.additionalNotice} /> : null}
            </article>

            <div className={styles.actionBar}>
              <button
                type="button"
                className={`${styles.actionStar} ${job.isBookmarked ? styles.bookmarked : ""}`}
                aria-label={job.isBookmarked ? "찜 해제" : "찜하기"}
                disabled={bookmarkPending}
                onClick={() => void toggleBookmark()}
              >
                <StarIcon filled={job.isBookmarked} />
                <span>일정 담기</span>
              </button>
              {job.isClosed || (!job.applyUrl && !job.emailApplyAddress) ? (
                <button type="button" className={styles.disabledApply} disabled>
                  {job.isClosed ? "접수 마감" : "지원 링크 없음"}
                </button>
              ) : job.emailApplyAddress ? (
                <a href={`mailto:${job.emailApplyAddress}`} className={styles.apply}>
                  이메일로 지원하기
                </a>
              ) : (
                <a href={job.applyUrl!} target="_blank" rel="noreferrer" className={styles.apply}>
                  지원하기
                </a>
              )}
            </div>
          </>
        ) : null}
        <AppFooter />
      </section>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className={styles.fact}><small>{label}</small><strong>{value}</strong></div>;
}

function DetailSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className={styles.detailSection}>
      <h3><span aria-hidden="true">{icon}</span>{title}</h3>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <dl className={styles.infoRow}><dt>{label}</dt><dd>{value}</dd></dl>;
}

function RichText({ value, empty }: { value: string | null; empty?: string }) {
  return <p className={styles.richText}>{value?.trim() || empty}</p>;
}

function toHiringCount(value: number | null) {
  return value == null ? "정보 없음" : `${value.toLocaleString("ko-KR")}명`;
}

function toDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function toCompactPeriod(start: string | null, end: string | null) {
  const format = (value: string | null) => value
    ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)).replace(/\s/g, "")
    : "";
  const formattedStart = format(start);
  const formattedEnd = format(end);
  if (!formattedStart && !formattedEnd) return "상시";
  if (!formattedStart) return `~${formattedEnd}`;
  if (!formattedEnd) return `${formattedStart}~`;
  return `${formattedStart}~${formattedEnd}`;
}
function toDateTime(value: string | null) {
  if (!value) return "상시";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value)).replace(/\s/g, " ");
}
function toRemainingText(value: string | null) {
  if (!value) return "상시 채용 중이에요";
  const days = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
  return days === 0 ? "오늘 마감이에요" : `마감까지 ${days}일 남았어요`;
}
function toDeadlineDetail(value: string | null) {
  return value ? `(~ ${toDateTime(value)})` : "(마감일 정보 없음)";
}
function isUrgentJob(job: Pick<JobPostingDetailDto, "dday" | "isClosed">) {
  return job.isClosed || job.dday === "D-Day" || job.dday === "D-1";
}
function getDdayBadgeClass(job: Pick<JobPostingDetailDto, "dday" | "isClosed">) {
  if (job.isClosed) return styles.closedBadge;
  return isUrgentJob(job) ? styles.urgentBadge : styles.openBadge;
}
function getDeadlineNoticeClass(job: Pick<JobPostingDetailDto, "dday" | "isClosed">) {
  if (job.isClosed) return styles.closedNotice;
  return isUrgentJob(job) ? styles.urgentNotice : styles.openNotice;
}
function extractBasicValue(value: string | null, label: string) {
  if (!value) return null;
  const match = value.match(new RegExp(`${label}\\s*[:：]?\\s*([^\\n,]+)`));
  return match?.[1]?.trim() || null;
}
function getFileBadge(fileType: string | null, fileName: string) {
  const extension = fileType || fileName.split(".").pop() || "파일";
  return extension.replace(/^\./, "").slice(0, 5).toUpperCase();
}

function StarIcon({ filled }: { filled: boolean }) { return <svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34L2.78 9.5l6.37-.93L12 2.8Z" fill={filled ? "currentColor" : "white"} /></svg>; }
function DownloadIcon() { return <svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/></svg>; }
