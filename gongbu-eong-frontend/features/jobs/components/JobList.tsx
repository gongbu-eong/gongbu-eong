"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHomeJobs, getJobPostings } from "@/features/home/home.api";
import type { JobPostingDto } from "@/features/home/home.dto";
import styles from "./JobList.module.css";

export function JobList({ recommended }: { recommended: boolean }) {
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeName, setTypeName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const request = recommended
      ? getHomeJobs().then((response) => {
          setTypeName(response.recommendationTypeName);
          return response.recommendedJobs;
        })
      : getJobPostings({ limit: 50 }).then((response) => response.items);

    request
      .then((items) => {
        if (mounted) setJobs(items);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [recommended]);

  return (
    <main className={styles.page}>
      <section className={styles.frame}>
        <header className={styles.header}>
          <Link href="/" aria-label="홈으로 돌아가기">←</Link>
          <h1>{recommended ? "진단결과 추천 공고" : "채용 공고"}</h1>
          <span />
        </header>

        {recommended && typeName ? (
          <p className={styles.summary}>
            <strong>{typeName}</strong>과 연관된 직무의 진행 중 공고입니다.
          </p>
        ) : null}

        <div className={styles.list}>
          {jobs.map((job) => (
            <a
              href={job.applyUrl || "#"}
              key={job.id}
              className={styles.card}
              target={job.applyUrl ? "_blank" : undefined}
              rel={job.applyUrl ? "noreferrer" : undefined}
            >
              <span className={styles.top}>
                <small>{job.institutionName}</small>
                <em>{job.dday}</em>
              </span>
              <strong>{job.title}</strong>
              <span className={styles.tags}>
                {job.employmentType ? <small>{job.employmentType}</small> : null}
                {job.region ? <small>{job.region}</small> : null}
                {job.careerRequirement ? <small>{job.careerRequirement}</small> : null}
              </span>
              {job.categories.length ? (
                <p>{job.categories.join(" · ")}</p>
              ) : null}
            </a>
          ))}

          {!isLoading && jobs.length === 0 ? (
            <p className={styles.empty}>
              {recommended
                ? "최근 진단 결과와 연결된 진행 중 공고가 없습니다."
                : "현재 진행 중인 공고가 없습니다."}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
