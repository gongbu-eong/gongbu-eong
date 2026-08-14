"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getResume } from "../my.api";
import type { ResumeDto, ResumeEntryDto } from "../my.dto";
import styles from "./My.module.css";

type ViewEntryLine = {
  text: string;
  tone?: "sub" | "accent";
};

type ViewEntry = {
  title: string;
  lines: ViewEntryLine[];
  size: "education" | "regular" | "tall";
};

export function MyResumeView({ resumeId }: { resumeId: string }) {
  const [resume, setResume] = useState<ResumeDto | null>(null);

  useEffect(() => {
    getResume(resumeId).then((response) => setResume(response.resume));
  }, [resumeId]);

  return (
    <div className={`${styles.page} ${styles.resumeViewPage}`}>
      <AppHeader />
      <main className={`${styles.frame} ${styles.resumeViewFrame}`}>
        <h1 className={styles.title}>이력서 보기</h1>

        {!resume ? <p className={styles.subtitle}>이력서를 불러오고 있어요.</p> : null}

        {resume ? (
          <>
            <section className={styles.detailSection}>
              <h2>이력서 제목</h2>
              <div className={styles.surfaceBox}>{formatDisplayText(resume.title) || "이력서"}</div>
            </section>

            <ResumeEntrySection
              title="학력"
              entries={buildEducationEntries(resume)}
              fallback={formatDisplayText(resume.schoolMajor) || formatDisplayText(resume.educationSummary)}
            />
            <ResumeEntrySection title="경력" entries={resume.experiences} fallback={formatDisplayText(resume.careerSummary)} kind="experience" />
            <ResumeEntrySection title="수상" entries={resume.awards} kind="award" />
            <ResumeEntrySection title="활동" entries={resume.activities} kind="activity" />
            <ResumeEntrySection title="자격증" entries={resume.certifications} fallback={formatDisplayText(resume.certificationSummary)} kind="certification" />
            <ResumeEntrySection title="어학" entries={resume.languages} kind="language" />
            <ResumeTextSection title="기타 추가사항" value={resume.additionalNotes} />

            <Link href="/my/resumes" className={`${styles.ghostButton} ${styles.saveButton}`}>
              목록으로
            </Link>
          </>
        ) : null}
      </main>
      <AppFooter active="my" />
    </div>
  );
}

function ResumeEntrySection({
  title,
  entries,
  fallback,
  kind = "generic",
}: {
  title: string;
  entries?: ResumeEntryDto[];
  fallback?: string | null;
  kind?: "generic" | "experience" | "award" | "activity" | "certification" | "language";
}) {
  const visibleEntries = entries?.filter((entry) => formatDisplayText(entry.title) || formatDisplayText(entry.subtitle) || formatDisplayText(entry.schoolName) || formatDisplayText(entry.companyName) || formatDisplayText(entry.certificationName) || formatDisplayText(entry.testName) || formatDisplayText(entry.contestName) || formatDisplayText(entry.activityName)) || [];

  if (visibleEntries.length === 0 && !fallback) return null;

  return (
    <section className={styles.detailSection}>
      <h2>{title}</h2>
      <div className={styles.entryList}>
        {visibleEntries.length > 0
          ? visibleEntries.map((entry, index) => {
              const display = formatResumeEntry(kind, entry);
              return (
              <div
                key={`${entry.id || entry.title}-${index}`}
                className={`${styles.entryCard} ${display.size === "education" ? styles.entryCardEducation : ""} ${display.size === "tall" ? styles.entryCardTall : ""}`}
              >
                <strong>{display.title || "-"}</strong>
                {display.lines.map((line) => (
                  <span key={line.text} className={line.tone === "accent" ? styles.entryCardAccent : ""}>{line.text}</span>
                ))}
              </div>
              );
            })
          : (
              <div className={styles.surfaceBox}>{fallback}</div>
            )}
      </div>
    </section>
  );
}

function ResumeTextSection({ title, value }: { title: string; value?: string | null }) {
  const text = formatDisplayText(value);
  if (!text) return null;

  return (
    <section className={styles.detailSection}>
      <h2>{title}</h2>
      <div className={styles.surfaceBox}>{text}</div>
    </section>
  );
}

function buildEducationEntries(resume: ResumeDto) {
  const visibleEducation = buildVisibleEducationEntry(resume);
  if (visibleEducation) return [visibleEducation];

  const fallbackEducation = selectPreferredEducation(resume.educations);
  return fallbackEducation ? [fallbackEducation] : [];
}

function buildVisibleEducationEntry(resume: ResumeDto): ResumeEntryDto | null {
  if (!formatDisplayText(resume.highestEducation) && !formatDisplayText(resume.schoolMajor) && !formatDisplayText(resume.gpa) && !formatDisplayText(resume.educationStartDate) && !formatDisplayText(resume.educationEndDate)) {
    return null;
  }

  return {
    title: formatDisplayText(resume.schoolMajor) || formatDisplayText(resume.educationSummary) || formatDisplayText(resume.highestEducation),
    schoolName: formatDisplayText(resume.schoolMajor) || formatDisplayText(resume.educationSummary) || formatDisplayText(resume.highestEducation),
    degree: formatDisplayText(resume.highestEducation),
    graduationStatus: formatDisplayText(resume.graduationStatus),
    gpaScore: formatDisplayText(resume.gpaScore),
    gpaMax: formatDisplayText(resume.gpaMax),
    startDate: formatDisplayText(resume.educationStartDate),
    endDate: formatDisplayText(resume.educationEndDate),
  };
}

function selectPreferredEducation(entries?: ResumeEntryDto[]) {
  const candidates = [...(entries || [])].filter((entry) => formatDisplayText(entry.title) || formatDisplayText(entry.schoolName) || formatDisplayText(entry.degree));
  if (!candidates.length) return null;

  return candidates.sort((left, right) => {
    const dateDelta = monthScore(right.endDate || right.startDate) - monthScore(left.endDate || left.startDate);
    if (dateDelta !== 0) return dateDelta;
    return educationRank(right) - educationRank(left);
  })[0];
}

function educationRank(entry?: ResumeEntryDto) {
  const text = [entry?.degree, entry?.schoolName, entry?.title, entry?.major].map(formatDisplayText).join(" ");
  if (/박사|doctor|ph\.?d/i.test(text)) return 60;
  if (/석사|master/i.test(text)) return 50;
  if (/대학원/.test(text)) return 45;
  if (/대학교|대학|학사|bachelor/i.test(text)) return 40;
  if (/고등학교|고교/.test(text)) return 20;
  return text ? 10 : 0;
}

function formatResumeEntry(
  kind: "generic" | "experience" | "award" | "activity" | "certification" | "language",
  entry: ResumeEntryDto,
): ViewEntry {
  if (kind === "experience") {
    return {
      title: formatDisplayText(entry.companyName) || formatDisplayText(entry.title),
      lines: compactLines([
        [formatDisplayText(entry.position), formatDisplayText(entry.duties) || formatDisplayText(entry.subtitle)].filter(Boolean).join("·"),
        formatCareerRange(entry.startDate, entry.endDate),
      ]),
      size: "regular",
    };
  }

  if (kind === "award") {
    return {
      title: formatDisplayText(entry.contestName) || formatDisplayText(entry.title),
      lines: compactLines([
        formatDisplayText(entry.issuer),
        [formatDisplayText(entry.awardName) || formatDisplayText(entry.subtitle), formatDateText(entry.awardedDate || entry.startDate)].filter(Boolean).join("·"),
      ]),
      size: "regular",
    };
  }

  if (kind === "activity") {
    return {
      title: formatDisplayText(entry.activityName) || formatDisplayText(entry.title),
      lines: compactLines([formatDisplayText(entry.description) || formatDisplayText(entry.subtitle), formatDisplayText(entry.issuer), formatRange(entry.startDate || entry.activityDate, entry.endDate)]),
      size: "tall",
    };
  }

  if (kind === "certification") {
    return {
      title: formatDisplayText(entry.certificationName) || formatDisplayText(entry.title),
      lines: compactLines([formatDisplayText(entry.issuer) || formatDisplayText(entry.subtitle), formatDateText(entry.acquiredDate || entry.startDate)]),
      size: "regular",
    };
  }

  if (kind === "language") {
    return {
      title: formatDisplayText(entry.testName) || formatDisplayText(entry.title),
      lines: compactLines([
        formatDisplayText(entry.issuer),
        [formatDisplayText(entry.levelOrScore), formatDisplayText(entry.language)].filter(Boolean).join("·"),
        formatDateText(entry.acquiredDate || entry.startDate),
      ]),
      size: "tall",
    };
  }

  const range = formatEducationRange(entry.startDate, entry.endDate);
  const educationLines = compactLines([
    formatEducationStatus(entry.degree, entry.graduationStatus),
    formatEducationMajor(entry),
    formatGpa(entry),
    range,
  ]);
  return {
    title: formatDisplayText(entry.schoolName) || formatDisplayText(entry.title),
    lines: educationLines.length ? educationLines : compactLines([formatDisplayText(entry.subtitle)]),
    size: "education",
  };
}

function compactLines(values: Array<string | ViewEntryLine | undefined | null>) {
  return values
    .map((value) => typeof value === "string" ? { text: value } : value)
    .filter((value): value is ViewEntryLine => Boolean(value?.text.trim()));
}

function formatGpa(entry: ResumeEntryDto) {
  const gpaScore = formatDisplayText(entry.gpaScore);
  const gpaMax = formatDisplayText(entry.gpaMax);
  if (gpaScore && gpaMax) return `학점 ${gpaScore} / ${gpaMax}`;
  return gpaScore;
}

function formatEducationMajor(entry: ResumeEntryDto) {
  const major = formatDisplayText(entry.major);
  if (!major) return "";
  if (isEducationMetaLine(major, entry)) return "";
  return major;
}

function isEducationMetaLine(value: string, entry: ResumeEntryDto) {
  const text = value.replace(/\s/g, "");
  const graduationStatus = formatDisplayText(entry.graduationStatus).replace(/\s/g, "");
  const range = formatRange(entry.startDate, entry.endDate).replace(/\s/g, "");
  const hasDate = /(?:19|20)\d{2}[.-]\d{2}/.test(text);

  return Boolean(
    (graduationStatus && text === graduationStatus) ||
      (graduationStatus && hasDate && text.includes(graduationStatus)) ||
      (range && text === range) ||
      (range && graduationStatus && text.includes(range) && text.includes(graduationStatus)),
  );
}

function formatEducationStatus(degree?: string | null, graduationStatus?: string | null) {
  const status = [formatDisplayText(degree), formatDisplayText(graduationStatus)].filter(Boolean).join("  |  ");
  return status ? { text: status, tone: "sub" as const } : "";
}

function formatEducationRange(start?: string | null, end?: string | null) {
  const parts = compactPlainLines([formatDateText(start), formatDateText(end)]);
  return parts.length ? { text: parts.join(" ~ "), tone: "accent" as const } : "";
}

function formatRange(start?: string | null, end?: string | null) {
  const parts = compactPlainLines([formatDateText(start), formatDateText(end)]);
  return parts.length ? parts.join("~") : "";
}

function formatCareerRange(start?: string | null, end?: string | null) {
  const range = formatRange(start, end);
  const years = careerYearsLabel(start, end);
  return range && years ? `${range}(${years})` : range;
}

function formatDateText(value?: string | null) {
  return formatDisplayText(value).replace(/-/g, ".");
}

function compactPlainLines(values: Array<string | undefined | null>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function careerYearsLabel(start?: string | null, end?: string | null) {
  const startScore = monthScore(start);
  const endScore = monthScore(end);
  if (!startScore || !endScore) return "";
  const months = Math.max(1, endScore - startScore + 1);
  return `${Math.max(1, Math.ceil(months / 12))}년차`;
}

function monthScore(value?: string | null) {
  const match = formatDisplayText(value).match(/^((?:19|20)\d{2})[.-](\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 12 + Number(match[2]);
}

function formatDisplayText(value?: string | null) {
  const next = value?.trim();
  if (!next || /^(null|undefined)$/i.test(next)) return "";
  return next;
}
