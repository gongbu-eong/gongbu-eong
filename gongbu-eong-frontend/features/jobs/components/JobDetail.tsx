"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  getJobPosting,
  setJobBookmark,
} from "@/features/home/home.api";
import { trackProductEvent } from "@/features/analytics/analytics.api";
import type { JobPostingDetailDto } from "@/features/home/home.dto";
import { AppHeader } from "@/features/layout/components/AppChrome";
import { makeLoginHref } from "@/shared/navigation/login";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import styles from "./JobDetail.module.css";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

type JobDetailBannerVariant = {
  key: string;
  name: string;
  kind: "resume" | "strength";
  targetPath: string;
  image?: { src: string; width: number; height: number; className: string };
};

const jobDetailBannerVariants: JobDetailBannerVariant[] = [
  {
    key: "job_detail_resume_a",
    name: "자소서 배너 A",
    kind: "resume",
    targetPath: "/ai-tools/coaching",
    image: {
      src: "/jobs/detail/banner-resume-a-owl.png",
      width: 91,
      height: 86,
      className: "resumeA",
    },
  },
  {
    key: "job_detail_resume_b",
    name: "자소서 배너 B",
    kind: "resume",
    targetPath: "/ai-tools/coaching",
    image: {
      src: "/jobs/detail/banner-resume-b-owl.png",
      width: 91,
      height: 86,
      className: "resumeB",
    },
  },
  {
    key: "job_detail_strength_a",
    name: "강약점 배너 A",
    kind: "strength",
    targetPath: "/ai-tools/diagnosis",
    image: {
      src: "/jobs/detail/banner-strength-a-owl.png",
      width: 114,
      height: 94,
      className: "strengthA",
    },
  },
  {
    key: "job_detail_strength_b",
    name: "강약점 배너 B",
    kind: "strength",
    targetPath: "/ai-tools/diagnosis",
    image: {
      src: "/jobs/detail/banner-strength-b-owl-v2.png",
      width: 164,
      height: 172,
      className: "strengthB",
    },
  },
];

export function JobDetail({
  jobId,
  initialJob = null,
}: {
  jobId: string;
  initialJob?: JobPostingDetailDto | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<JobPostingDetailDto | null>(initialJob);
  const [authenticated, setAuthenticated] = useState(
    Boolean(initialJob?.isBookmarked),
  );
  const [loading, setLoading] = useState(!initialJob);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [qualificationExpanded, setQualificationExpanded] = useState(false);
  const [disqualificationExpanded, setDisqualificationExpanded] =
    useState(false);
  const [basicPreferenceExpanded, setBasicPreferenceExpanded] =
    useState(false);
  const [preferenceExpanded, setPreferenceExpanded] = useState(false);
  const [processExpanded, setProcessExpanded] = useState(false);
  const [coachingBannerExpanded, setCoachingBannerExpanded] = useState(true);
  const [bookmarkReadyOpen, setBookmarkReadyOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] =
    useState<JobDetailBannerVariant | null>(null);
  const bannerImpressionKeyRef = useRef<string | null>(null);
  useBodyScrollLock(bookmarkReadyOpen);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedBanner(
        jobDetailBannerVariants[
          Math.floor(Math.random() * jobDetailBannerVariants.length)
        ] || jobDetailBannerVariants[0],
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [jobId]);

  useEffect(() => {
    let mounted = true;

    if (initialJob) {
      getCurrentUser()
        .then((session) => {
          if (mounted) setAuthenticated(session.authenticated);
        })
        .catch(() => {
          if (mounted) setAuthenticated(false);
        });

      return () => {
        mounted = false;
      };
    }

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
  }, [initialJob, jobId]);

  const toggleCoachingBanner = () => {
    const willExpand = !coachingBannerExpanded;
    setCoachingBannerExpanded(willExpand);

    if (willExpand) {
      window.requestAnimationFrame(() => {
        window.scrollBy({ top: 114, behavior: "smooth" });
      });
    }
  };

  useEffect(() => {
    if (!job || !selectedBanner) return;
    const impressionKey = `${job.id}:${selectedBanner.key}`;
    if (bannerImpressionKeyRef.current === impressionKey) return;
    bannerImpressionKeyRef.current = impressionKey;

    trackProductEvent({
      eventType: "banner_impression",
      properties: {
        banner_key: selectedBanner.key,
        banner_name: selectedBanner.name,
        placement: "job_detail_bottom",
        target_path: selectedBanner.targetPath,
        job_id: job.id,
        institution_name: job.institutionName,
        job_title: job.title,
      },
    });
  }, [job, selectedBanner]);

  const trackSelectedBannerClick = () => {
    if (!job || !selectedBanner) return;

    trackProductEvent({
      eventType: "banner_click",
      properties: {
        banner_key: selectedBanner.key,
        banner_name: selectedBanner.name,
        banner_kind: selectedBanner.kind,
        placement: "job_detail_bottom",
        target_path: selectedBanner.targetPath,
        job_id: job.id,
        institution_name: job.institutionName,
        job_title: job.title,
      },
    });
  };

  const trackJobButtonClick = (
    eventType:
      | "job_detail_bookmark_click"
      | "job_detail_bookmark_ready_action"
      | "job_detail_apply_click",
    properties: Record<string, unknown>,
  ) => {
    if (!job) return;

    trackProductEvent({
      eventType,
      properties: {
        job_id: job.id,
        institution_name: job.institutionName,
        job_title: job.title,
        is_closed: job.isClosed,
        ...properties,
      },
    });
  };

  const setBookmarkState = async (nextBookmarked: boolean) => {
    if (!job) return false;

    setBookmarkPending(true);
    try {
      const result = await setJobBookmark(job.id, nextBookmarked);
      setJob({ ...job, isBookmarked: result.isBookmarked });
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "찜 상태를 바꾸지 못했습니다.",
      );
      return false;
    } finally {
      setBookmarkPending(false);
    }
  };

  const toggleBookmark = () => {
    if (!job || bookmarkPending) return;
    if (!authenticated) {
      router.push(makeLoginHref(`/jobs/${job.id}`));
      return;
    }

    trackJobButtonClick("job_detail_bookmark_click", {
      action: job.isBookmarked ? "remove" : "prepare",
      next_bookmarked: !job.isBookmarked,
    });

    if (!job.isBookmarked) {
      setBookmarkReadyOpen(true);
      return;
    }

    void setBookmarkState(false);
  };

  const completeBookmarkReady = async (targetPath?: string) => {
    if (!job || bookmarkPending) return;

    trackJobButtonClick("job_detail_bookmark_ready_action", {
      action: targetPath ? "confirm_and_coach" : "confirm_and_close",
      next_bookmarked: true,
      target_path: targetPath || null,
    });

    const saved = await setBookmarkState(true);
    if (!saved) return;

    setBookmarkReadyOpen(false);
    if (targetPath) router.push(targetPath);
  };

  const trackApplyClick = (applyMethod: "email" | "external", target: string) => {
    trackJobButtonClick("job_detail_apply_click", {
      apply_method: applyMethod,
      target_path: target,
    });
  };
  const emailAddress = job ? getEmailAddress(job) : null;
  const preferenceConditionText = job?.preferenceCondition?.trim() ?? "";
  const processText = job
    ? [job.applicationMethod, job.screeningProcess, job.requiredDocuments]
        .filter(Boolean)
        .join("\n\n")
    : "";

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
                  {job.isClosed ? "접수 마감" : job.dday}
                </span>
                <small>{job.institutionName}</small>
                <h2>{job.title}</h2>
              </section>

              <section className={styles.factGrid}>
                <Fact
                  label="접수 기간"
                  value={
                    job.isClosed
                      ? "마감"
                      : toShortDeadline(job.applicationEndAt) ||
                        toCompactPeriod(
                          job.applicationStartAt,
                          job.applicationEndAt,
                        )
                  }
                />
                <Fact label="근무지" value={job.region || "정보 없음"} />
                <Fact label="채용인원" value={toHiringCount(job.hiringCount)} />
                <Fact label="고용형태" value={job.employmentType || "정보 없음"} />
              </section>

              <div className={getDeadlineNoticeClass(job)}>
                <strong>{toDeadlineNoticeTitle(job)}</strong>
                <span>{toDeadlineNoticeDetail(job)}</span>
              </div>

              <DetailSection title="기본 정보" icon="basic">
                <InfoRow label="표준직무(NCS)" value={job.ncsCategory || job.categories.join(" · ") || job.jobCategory} />
                <InfoRow label="학력정보" value={job.educationRequirement} />
                <InfoRow label="채용구분" value={job.careerRequirement} />
                <InfoRow label="고용형태" value={job.employmentType} />
                <InfoRow label="대체인력" value={extractBasicValue(job.basicInfo, "대체인력")} />
                <InfoRow label="근무지역" value={job.region} />
                <InfoRow label="채용인원" value={toHiringCount(job.hiringCount)} />
                <CollapsibleInfoRow
                  label="우대조건"
                  value={preferenceConditionText}
                  expanded={basicPreferenceExpanded}
                  onToggle={() =>
                    setBasicPreferenceExpanded((expanded) => !expanded)
                  }
                />
                <InfoRow label="채용기간" value={toCompactPeriod(job.applicationStartAt, job.applicationEndAt)} />
                <InfoRow label="등록일" value={toDate(job.announcementAt)} />
              </DetailSection>

              <DetailSection title="응시자격" icon="qualification">
                <CollapsibleRichText
                  value={job.qualification}
                  empty="등록된 지원 자격 정보가 없습니다."
                  label="응시자격"
                  expanded={qualificationExpanded}
                  collapsedLines={5}
                  onToggle={() =>
                    setQualificationExpanded((expanded) => !expanded)
                  }
                />
              </DetailSection>

              {job.disqualification ? (
                <DetailSection title="결격사유" icon="disqualification">
                  <CollapsibleRichText
                    value={job.disqualification}
                    label="결격사유"
                    expanded={disqualificationExpanded}
                    collapsedLines={5}
                    onToggle={() =>
                      setDisqualificationExpanded((expanded) => !expanded)
                    }
                  />
                </DetailSection>
              ) : null}

              <DetailSection title="우대내용" icon="preference">
                <CollapsibleRichText
                  value={job.preference}
                  empty="등록된 우대 내용이 없습니다."
                  label="우대내용"
                  expanded={preferenceExpanded}
                  collapsedLines={5}
                  onToggle={() =>
                    setPreferenceExpanded((expanded) => !expanded)
                  }
                />
              </DetailSection>

              <DetailSection title="전형절차 / 방법" icon="process">
                <CollapsibleRichText
                  value={processText}
                  empty="등록된 전형 정보가 없습니다."
                  label="전형절차 / 방법"
                  expanded={processExpanded}
                  collapsedLines={5}
                  onToggle={() =>
                    setProcessExpanded((expanded) => !expanded)
                  }
                />
              </DetailSection>

              {job.files.length ? (
                <DetailSection title="첨부파일" icon="attachment">
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
            {selectedBanner ? (
              <>
                <div
                  className={`${styles.coachingBannerSpacer} ${
                    coachingBannerExpanded
                      ? styles.coachingBannerSpacerExpanded
                      : ""
                  }`}
                  aria-hidden="true"
                />

                <div
                  className={`${styles.coachingBannerDock} ${
                    coachingBannerExpanded
                      ? styles.coachingBannerDockExpanded
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    className={styles.coachingBannerToggle}
                    aria-label={
                      coachingBannerExpanded
                        ? "공고 상세 배너 접기"
                        : "공고 상세 배너 펼치기"
                    }
                    aria-expanded={coachingBannerExpanded}
                    onClick={toggleCoachingBanner}
                  >
                    {coachingBannerExpanded ? "▼" : "▲"}
                  </button>
                  <div className={styles.coachingBannerViewport}>
                    <JobDetailPromoBanner
                      banner={selectedBanner}
                      institutionName={job.institutionName}
                      onClick={trackSelectedBannerClick}
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div className={styles.actionBar}>
              <button
                type="button"
                className={`${styles.actionStar} ${job.isBookmarked ? styles.bookmarked : ""}`}
                aria-label={job.isBookmarked ? "찜 해제" : "찜하기"}
                disabled={bookmarkPending}
                onClick={toggleBookmark}
              >
                <StarIcon filled={job.isBookmarked} />
                <span>공고 찜하고 준비하기</span>
              </button>
              {job.isClosed || (!job.applyUrl && !emailAddress) ? (
                <button type="button" className={styles.disabledApply} disabled>
                  {job.isClosed ? "접수 마감" : "지원 링크 없음"}
                </button>
              ) : emailAddress ? (
                <a
                  href={`mailto:${emailAddress}`}
                  className={styles.apply}
                  onClick={() =>
                    trackApplyClick("email", `mailto:${emailAddress}`)
                  }
                >
                  이메일로 지원하기
                </a>
              ) : (
                <a
                  href={job.applyUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.apply}
                  onClick={() => trackApplyClick("external", job.applyUrl!)}
                >
                  지원하기
                </a>
              )}
            </div>
            {bookmarkReadyOpen ? (
              <BookmarkReadyDialog
                pending={bookmarkPending}
                onCoach={() => void completeBookmarkReady("/ai-tools/coaching")}
                onClose={() => void completeBookmarkReady()}
              />
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

function JobDetailPromoBanner({
  banner,
  institutionName,
  onClick,
}: {
  banner: JobDetailBannerVariant;
  institutionName: string;
  onClick: () => void;
}) {
  const promoClass = styles[`promo_${banner.key}`] || "";
  const imageClass = banner.image ? styles[banner.image.className] || "" : "";

  return (
    <Link
      href={banner.targetPath}
      className={`${styles.coachingBanner} ${promoClass}`}
      onClick={onClick}
    >
      <span className={styles.coachingBannerText}>
        {banner.key === "job_detail_resume_a" ? (
          <>
            <strong>
              자소서 첨삭비 <b>10만원?</b> 지금은 <em>0원</em>
            </strong>
            <small>AI NCS 코칭으로 무료로 합격 문장 받기.</small>
          </>
        ) : null}
        {banner.key === "job_detail_resume_b" ? (
          <>
            <strong>
              <em>{institutionName}</em>
              <span>자소서 준비 중이세요?</span>
            </strong>
            <small>AI NCS 코칭으로 무료로 합격 문장 받으세요!</small>
          </>
        ) : null}
        {banner.key === "job_detail_strength_a" ? (
          <>
            <strong>
              내 자소서 소재가 <b>안 떠오른다면?</b>
            </strong>
            <small>
              강점에서 시작하면 쓸 만한 경험이<br />
              더 쉽게 보입니다
            </small>
          </>
        ) : null}
        {banner.key === "job_detail_strength_b" ? (
          <>
            <strong>
              자소서 쓰기 전에, 내 <em>강점</em>부터
            </strong>
            <small>
              어떤 경험을 써야 할지 모르겠다면<br />
              내 강점에서 시작해보세요
            </small>
          </>
        ) : null}
      </span>
      {banner.image ? (
        <Image
          src={banner.image.src}
          alt=""
          width={banner.image.width}
          height={banner.image.height}
          className={`${styles.coachingBannerOwl} ${imageClass}`}
          unoptimized
        />
      ) : null}
    </Link>
  );
}

function BookmarkReadyDialog({
  pending,
  onCoach,
  onClose,
}: {
  pending: boolean;
  onCoach: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.bookmarkDialogOverlay} role="presentation">
      <section
        className={styles.bookmarkDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmark-ready-title"
      >
        <Image
          src="/jobs/detail/bookmark-ready-owl.png"
          alt=""
          width={114}
          height={104}
          className={styles.bookmarkReadyOwl}
          priority
          unoptimized
        />
        <h2 id="bookmark-ready-title">공고를 찜했어요!</h2>
        <p>
          이 공고에 지원할 예정이라면,
          <br />
          작성한 자소서도 NCS 기준으로
          <br />
          한번 점검해볼까요?
        </p>
        <button
          type="button"
          className={styles.bookmarkCoachButton}
          disabled={pending}
          onClick={onCoach}
        >
          AI NCS 자소서 코칭하러 가기
        </button>
        <button
          type="button"
          className={styles.bookmarkCloseButton}
          disabled={pending}
          onClick={onClose}
        >
          찜하고 닫기
        </button>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className={styles.fact}><small>{label}</small><strong>{value}</strong></div>;
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: DetailSectionIconKey;
  children: ReactNode;
}) {
  const image = detailSectionIcons[icon];

  return (
    <section className={styles.detailSection}>
      <h3>
        <Image
          src={image.src}
          alt=""
          width={image.width}
          height={image.height}
          className={styles.detailSectionIcon}
        />
        {title}
      </h3>
      {children}
    </section>
  );
}

type DetailSectionIconKey =
  | "basic"
  | "qualification"
  | "disqualification"
  | "preference"
  | "process"
  | "attachment";

const detailSectionIcons: Record<
  DetailSectionIconKey,
  { src: string; width: number; height: number }
> = {
  basic: { src: "/jobs/detail/section-basic-v3.png", width: 24, height: 27 },
  qualification: {
    src: "/jobs/detail/section-qualification-v4.svg",
    width: 28,
    height: 28,
  },
  disqualification: {
    src: "/jobs/detail/section-disqualification-v3.png",
    width: 24,
    height: 27,
  },
  preference: {
    src: "/jobs/detail/section-preference-v3.png",
    width: 24,
    height: 27,
  },
  process: { src: "/jobs/detail/section-process-v3.png", width: 24, height: 27 },
  attachment: {
    src: "/jobs/detail/section-attachment-v3.png",
    width: 24,
    height: 28,
  },
};

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <dl className={styles.infoRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}

function CollapsibleInfoRow({
  label,
  value,
  expanded,
  onToggle,
}: {
  label: string;
  value: string | null | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const text = value?.trim();
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const [canToggle, setCanToggle] = useState(false);

  useEffect(() => {
    const measure = () => {
      const element = valueRef.current;
      if (!element) return;

      const lineHeight = Number.parseFloat(
        window.getComputedStyle(element).lineHeight,
      );
      const renderedLines = getRenderedLineCount(element, lineHeight, 22);

      setCanToggle(renderedLines > 5);
    };

    measure();
    window.addEventListener("resize", measure);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);

    if (resizeObserver && valueRef.current) {
      resizeObserver.observe(valueRef.current);
    }

    return () => {
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, [text]);

  if (!text) return null;

  return (
    <>
      <dl className={`${styles.infoRow} ${styles.basicPreferenceRow}`}>
        <dt>{label}</dt>
        <dd>
          <span
            ref={valueRef}
            className={`${styles.basicPreferenceValue} ${
              canToggle && !expanded
                ? styles.basicPreferenceValueCollapsed
                : styles.basicPreferenceValueExpanded
            }`}
          >
            {text}
          </span>
        </dd>
      </dl>
      {canToggle ? (
        <button
          type="button"
          className={styles.basicMoreButton}
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {label} {expanded ? "접기  ▲" : "더 보기  ▼"}
        </button>
      ) : null}
    </>
  );
}

function RichText({ value, empty }: { value: string | null; empty?: string }) {
  return <p className={styles.richText}>{value?.trim() || empty}</p>;
}

function getRenderedLineCount(
  element: HTMLElement,
  lineHeight: number,
  fallbackLineHeight: number,
) {
  const resolvedLineHeight = Number.isFinite(lineHeight)
    ? lineHeight
    : fallbackLineHeight;

  return Math.ceil(element.scrollHeight / resolvedLineHeight);
}

function CollapsibleRichText({
  value,
  empty,
  label,
  expanded,
  collapsedLines,
  onToggle,
}: {
  value: string | null;
  empty?: string;
  label: string;
  expanded: boolean;
  collapsedLines: number;
  onToggle: () => void;
}) {
  const text = value?.trim();
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [canToggle, setCanToggle] = useState(false);

  useEffect(() => {
    if (!text) return;

    const measure = () => {
      const element = textRef.current;
      if (!element) return;

      const lineHeight = Number.parseFloat(
        window.getComputedStyle(element).lineHeight,
      );
      const renderedLines = getRenderedLineCount(element, lineHeight, 26.4);

      setCanToggle(renderedLines > collapsedLines);
    };

    measure();
    window.addEventListener("resize", measure);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);

    if (resizeObserver && textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => {
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, [collapsedLines, text]);

  if (!text) {
    return <RichText value={value} empty={empty} />;
  }

  return (
    <div className={styles.collapsibleContent}>
      <p
        ref={textRef}
        className={`${styles.richText} ${styles.collapsibleText} ${
          canToggle && !expanded ? "" : styles.expandedText
        }`}
        style={{ "--collapsed-lines": collapsedLines } as CSSProperties}
      >
        {text}
      </p>
      {canToggle ? (
        <button
          type="button"
          className={styles.moreButton}
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {label} {expanded ? "접기  ▲" : "더보기  ▼"}
        </button>
      ) : null}
    </div>
  );
}

function toHiringCount(value: number | null) {
  return value == null ? "정보 없음" : `${value.toLocaleString("ko-KR")}명`;
}

function toDate(value: string | null) {
  return toSeoulDateText(value, "full");
}

function toCompactPeriod(start: string | null, end: string | null) {
  const format = (value: string | null) => toSeoulDateText(value, "full") ?? "";
  const formattedStart = format(start);
  const formattedEnd = format(end);
  if (!formattedStart && !formattedEnd) return "상시";
  if (!formattedStart) return `~${formattedEnd}`;
  if (!formattedEnd) return `${formattedStart}~`;
  return `${formattedStart}~${formattedEnd}`;
}

function toShortDeadline(value: string | null) {
  const formatted = toSeoulDateText(value, "short");
  return formatted ? `~ ${formatted}` : null;
}

function toRemainingText(value: string | null) {
  if (!value) return "상시 채용 중이에요";
  const days = daysUntilDate(value);
  return days === 0 ? "오늘 마감이에요" : `마감까지 ${days}일 남았어요`;
}

const JOB_DETAIL_DAY_IN_MS = 86_400_000;
const jobDetailDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getSeoulDateParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = jobDetailDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return null;

  return { year, month, day };
}

function toSeoulDateText(value: string | null, variant: "full" | "short") {
  if (!value) return null;
  const parts = getSeoulDateParts(value);
  if (!parts) return null;

  return variant === "full"
    ? `${parts.year}.${parts.month}.${parts.day}`
    : `${parts.month}.${parts.day}`;
}

function daysUntilDate(value: string) {
  const endDay = toSeoulDayNumber(value);
  const todayDay = toSeoulDayNumber(new Date());
  if (endDay == null || todayDay == null) return 0;
  return Math.max(0, endDay - todayDay);
}

function toSeoulDayNumber(value: string | Date) {
  const parts = getSeoulDateParts(value);
  if (!parts) return null;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  return Math.floor(Date.UTC(year, month - 1, day) / JOB_DETAIL_DAY_IN_MS);
}

function toDeadlineNoticeTitle(
  job: Pick<
    JobPostingDetailDto,
    "applicationEndAt" | "isClosed"
  >,
) {
  if (job.isClosed) return "이 공고는 접수가 마감되었어요";
  if (!job.applicationEndAt) return "지금 접수 중이에요";
  return `지금 접수 중이에요! ${toRemainingText(job.applicationEndAt)}`;
}

function toDeadlineNoticeDetail(
  job: Pick<
    JobPostingDetailDto,
    "applicationStartAt" | "applicationEndAt" | "isClosed"
  >,
) {
  if (job.isClosed) {
    return `(${toCompactPeriod(job.applicationStartAt, job.applicationEndAt)})`;
  }

  const formattedEnd = toSeoulDateText(job.applicationEndAt, "full");
  return formattedEnd ? `(~ ${formattedEnd})` : "(마감일 정보 없음)";
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

function getEmailAddress(job: JobPostingDetailDto) {
  if (job.emailApplyAddress) return job.emailApplyAddress;
  const text = [
    job.applicationMethod,
    job.screeningProcess,
    job.requiredDocuments,
    job.additionalNotice,
    job.basicInfo,
  ].filter(Boolean).join("\n");
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
}

function StarIcon({ filled }: { filled: boolean }) {
  if (!filled) return <Image src="/jobs/detail/bookmark-star-outline.svg" alt="" width={28} height={28} />;
  return <svg viewBox="0 0 24 24"><path d="m12 2.8 2.85 5.77 6.37.93-4.61 4.49 1.09 6.34L12 17.34l-5.7 2.99 1.09-6.34L2.78 9.5l6.37-.93L12 2.8Z" fill="currentColor" /></svg>;
}
function DownloadIcon() {
  return <Image src="/jobs/detail/download-rounded.svg" alt="" width={24} height={24} />;
}
