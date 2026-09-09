"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getInterviewCoachingSession } from "../interview-coaching.api";
import type { InterviewCoachingSession } from "../interview-coaching.dto";
import styles from "./InterviewCoachingPage.module.css";

export function InterviewCoachingResultPage({
  sessionId,
  anonymousId,
}: {
  sessionId: string;
  anonymousId?: string | null;
}) {
  const [session, setSession] = useState<InterviewCoachingSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getInterviewCoachingSession(sessionId, anonymousId)
      .then((response) => {
        if (mounted) setSession(response.session);
      })
      .catch((caught) => {
        if (mounted) setError(caught instanceof Error ? caught.message : "면접 코칭 결과를 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [anonymousId, sessionId]);

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.frame}>
        <Link href="/ai-tools/interview-coaching" className={styles.lead}>‹ 다시 면접 코칭하기</Link>
        <h1>NCS 직무 기반 AI 면접 코칭 결과</h1>
        {error ? <p className={styles.error}>{error}</p> : null}
        {!session && !error ? <p className={styles.lead}>결과를 불러오고 있어요.</p> : null}
        {session?.result ? <ResultView session={session} /> : null}
        {session && !session.result ? (
          <p className={styles.lead}>아직 최종 결과가 생성되지 않았습니다. 면접 코칭 화면에서 결과를 먼저 생성해 주세요.</p>
        ) : null}
      </main>
      <AppFooter active="ai" />
    </div>
  );
}

function ResultView({ session }: { session: InterviewCoachingSession }) {
  const result = session.result;
  if (!result) return null;
  return (
    <>
      <section className={styles.resultHero}>
        <span>{session.companyName} · {session.positionName}</span>
        <strong>{result.score}<small>점</small></strong>
        <p>{result.summary}</p>
      </section>

      <section className={styles.resultSection}>
        <h2>잘한 점</h2>
        <ul>{result.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className={styles.resultSection}>
        <h2>보완할 점</h2>
        <ul>{result.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className={styles.resultSection}>
        <h2>문항별 답변 코칭</h2>
        <div className={styles.reviewList}>
          {result.questionReviews.map((review, index) => (
            <article className={styles.reviewCard} key={`${review.questionId}-${index}`}>
              <strong>{review.question}<b>{review.score}점</b></strong>
              <p>{review.summary}</p>
              <div className={styles.badgeList}>
                {review.ncsAreas.map((area) => <span key={area}>{area}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.resultSection}>
        <h2>추가 연습 질문</h2>
        <ul>{result.futurePracticeQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </>
  );
}
