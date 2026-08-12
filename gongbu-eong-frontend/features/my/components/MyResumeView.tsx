"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { JobFooter, JobHeader } from "@/features/jobs/components/JobChrome";
import { getResume } from "../my.api";
import type { ResumeDto, ResumeEntryDto } from "../my.dto";
import styles from "./My.module.css";

export function MyResumeView({ resumeId }: { resumeId: string }) {
  const [resume, setResume] = useState<ResumeDto | null>(null);

  useEffect(() => {
    getResume(resumeId).then((response) => setResume(response.resume));
  }, [resumeId]);

  return (
    <div className={styles.page}>
      <JobHeader />
      <main className={styles.frame}>
        <h1 className={styles.title}>이력서 보기</h1>

        {!resume ? <p className={styles.subtitle}>이력서를 불러오고 있어요.</p> : null}

        {resume ? (
          <>
            <section className={styles.detailSection}>
              <h2>이력서 제목</h2>
              <div className={styles.surfaceBox}>{resume.title}</div>
            </section>

            <section className={styles.detailSection}>
              <h2>기본 정보</h2>
              <dl className={`${styles.surfaceBox} ${styles.infoGrid}`}>
                <dt>이름</dt>
                <dd>{resume.name || "-"}</dd>
                <dt>생년</dt>
                <dd>{resume.birthYear || "-"}</dd>
                <dt>이메일</dt>
                <dd>{resume.email || "-"}</dd>
                <dt>희망 직무·분야</dt>
                <dd>{resume.desiredJob || "-"}</dd>
                <dt>최종 학력</dt>
                <dd>{resume.highestEducation || "-"}</dd>
                <dt>학점</dt>
                <dd>{resume.gpa || "-"}</dd>
                <dt>학교·전공</dt>
                <dd>{resume.schoolMajor || "-"}</dd>
              </dl>
            </section>

            <ResumeEntrySection title="학력" entries={resume.educations} fallback={resume.schoolMajor || resume.educationSummary} />
            <ResumeEntrySection title="경력" entries={resume.experiences} fallback={resume.careerSummary} />
            <ResumeEntrySection title="자격증" entries={resume.certifications} fallback={resume.certificationSummary} />

            <Link href="/my/resumes" className={`${styles.ghostButton} ${styles.saveButton}`}>
              목록으로
            </Link>
          </>
        ) : null}
      </main>
      <JobFooter active="my" />
    </div>
  );
}

function ResumeEntrySection({
  title,
  entries,
  fallback,
}: {
  title: string;
  entries?: ResumeEntryDto[];
  fallback?: string | null;
}) {
  const visibleEntries = entries?.filter((entry) => entry.title || entry.subtitle) || [];

  if (visibleEntries.length === 0 && !fallback) return null;

  return (
    <section className={styles.detailSection}>
      <h2>{title}</h2>
      <div className={styles.entryList}>
        {visibleEntries.length > 0
          ? visibleEntries.map((entry, index) => (
              <div key={`${entry.id || entry.title}-${index}`} className={styles.entryCard}>
                <strong>{entry.title || "-"}</strong>
                {entry.subtitle ? <span>{entry.subtitle}</span> : null}
                {entry.startDate || entry.endDate ? (
                  <span>
                    {[entry.startDate, entry.endDate].filter(Boolean).join(" ~ ")}
                  </span>
                ) : null}
              </div>
            ))
          : (
              <div className={styles.surfaceBox}>{fallback}</div>
            )}
      </div>
    </section>
  );
}
