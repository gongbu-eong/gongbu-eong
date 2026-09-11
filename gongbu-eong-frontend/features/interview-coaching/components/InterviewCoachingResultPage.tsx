"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getInterviewCoachingSession } from "../interview-coaching.api";
import type { InterviewCoachingSession, InterviewMessage, InterviewQuestion, NcsAreaName } from "../interview-coaching.dto";
import { InterviewAnalysisView } from "./InterviewCoachingPage";
import styles from "./InterviewCoachingPage.module.css";

type InterviewQuestionReview = NonNullable<InterviewCoachingSession["result"]>["questionReviews"][number];
const NCS_AREA_NAMES: NcsAreaName[] = [
  "의사소통능력",
  "수리능력",
  "문제해결능력",
  "자기개발능력",
  "대인관계능력",
  "정보능력",
  "직업윤리",
];

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
        if (mounted) setError(caught instanceof Error ? caught.message : "AI NCS 면접 코칭 결과를 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [anonymousId, sessionId]);

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.frame}>
        <Link href="/ai-tools/interview-coaching" className={styles.lead}>‹ 다시 AI NCS 면접 코칭하기</Link>
        <h1>AI NCS 면접 코칭 결과</h1>
        {error ? <p className={styles.error}>{error}</p> : null}
        {!session && !error ? <p className={styles.lead}>결과를 불러오고 있어요.</p> : null}
        {session?.result ? <ResultView session={session} /> : null}
        {session && !session.result ? (
          <p className={styles.lead}>아직 최종 결과가 생성되지 않았습니다. AI NCS 면접 코칭 화면에서 결과를 먼저 생성해 주세요.</p>
        ) : null}
      </main>
      <AppFooter active="ai" />
    </div>
  );
}

function ResultView({
  session,
}: {
  session: InterviewCoachingSession;
}) {
  const result = session.result;
  const firstAnsweredQuestionId =
    session.questions.find((question) => hasQuestionAnswer(session.messages, question.id))?.id ||
    session.questions[0]?.id ||
    "";
  const [activeQuestionId, setActiveQuestionId] = useState(firstAnsweredQuestionId);
  if (!result) return null;
  const displayPositionName = cleanDisplayText(session.positionName) || session.positionName;
  const strengths = cleanDisplayList(result.strengths);
  const improvements = cleanDisplayList(result.improvements);
  const futurePracticeQuestions = cleanDisplayList(result.futurePracticeQuestions);
  const selectedQuestion =
    session.questions.find((question) => question.id === activeQuestionId) ||
    session.questions[0] ||
    null;
  const selectedMessages = selectedQuestion
    ? session.messages.filter(
      (message) =>
        message.questionId === selectedQuestion.id &&
        (message.role === "answer" || message.role === "follow_up"),
    )
    : [];
  const selectedReview = selectedQuestion
    ? result.questionReviews.find((review) => review.questionId === selectedQuestion.id)
    : null;

  return (
    <>
      <section className={styles.resultSection}>
        <h2>문항별 답변 코칭</h2>
        <ResultQuestionTabs
          questions={session.questions}
          messages={session.messages}
          activeQuestionId={activeQuestionId}
          onSelect={setActiveQuestionId}
        />
        {selectedQuestion ? (
          <ResultQuestionDetail
            question={selectedQuestion}
            messages={selectedMessages}
            review={selectedReview}
          />
        ) : null}
      </section>

      <section className={styles.resultHero}>
        <h2>점수(토탈)</h2>
        <span>{session.companyName} · {displayPositionName}</span>
        <strong>{result.score}<small>/100점</small></strong>
        <p>{cleanDisplayText(result.summary) || result.summary}</p>
      </section>

      <InterviewAnalysisView session={session} mode="profile" profileTitle="직무내역 분석" />

      <section className={styles.resultSection}>
        <h2>잘한 점</h2>
        <ul>{strengths.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className={styles.resultSection}>
        <h2>보완할 점</h2>
        <ul>{improvements.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <section className={styles.resultSection}>
        <h2>추가 연습 질문</h2>
        <ul>{futurePracticeQuestions.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <InterviewAnalysisView session={session} mode="ncs" ncsTitle="NCS 관련 영역 매핑" />

      <Link href="/ai-tools/interview-coaching" className={styles.resultBackButton}>
        다시 코칭받기
      </Link>
    </>
  );
}

function ResultQuestionTabs({
  questions,
  messages,
  activeQuestionId,
  onSelect,
}: {
  questions: InterviewQuestion[];
  messages: InterviewMessage[];
  activeQuestionId: string;
  onSelect: (questionId: string) => void;
}) {
  const answered = new Set(
    messages.filter((message) => message.role === "answer").map((message) => message.questionId),
  );

  return (
    <nav className={styles.resultQuestionTabs} aria-label="결과 문항 선택">
      {questions.map((question, index) => {
        const isActive = question.id === activeQuestionId;
        const isAnswered = answered.has(question.id);
        return (
          <button
            type="button"
            key={question.id}
            className={`${isActive ? styles.questionTabActive : ""} ${isAnswered ? styles.questionTabAnswered : ""}`}
            onClick={() => onSelect(question.id)}
            aria-current={isActive ? "true" : undefined}
          >
            Q{index + 1}
          </button>
        );
      })}
    </nav>
  );
}

function ResultQuestionDetail({
  question,
  messages,
  review,
}: {
  question: InterviewQuestion;
  messages: InterviewMessage[];
  review: InterviewQuestionReview | null | undefined;
}) {
  const ncsAreas = review?.ncsAreas?.length ? review.ncsAreas : question.ncsAreas;

  return (
    <div className={styles.resultQuestionDetail}>
      <article className={styles.questionCard}>
        <div className={styles.questionMeta}>
          <span>{question.difficulty} · {formatQuestionType(question.type)}</span>
          {review ? <span>{review.score}점</span> : null}
        </div>
        <h2>{cleanDisplayText(question.question) || question.question}</h2>
        <p>{cleanDisplayText(question.intent) || question.intent}</p>
        <div className={styles.badgeList}>
          {ncsAreas.map((area) => <span key={area}>{area}</span>)}
        </div>
      </article>

      {review ? (
        <QuestionScoreBreakdown review={review} />
      ) : null}

      {review ? (
        <article className={styles.reviewCard}>
          <strong>최종 문항 평가<b>{review.score}점</b></strong>
          <p>{cleanDisplayText(review.summary) || review.summary}</p>
        </article>
      ) : null}

      {messages.length ? (
        <div className={styles.chatList}>
          {messages.map((message, messageIndex) => (
            <ResultConversationMessage
              message={message}
              ncsAreas={message.role === "follow_up" ? getFollowUpNcsAreas(messages, messageIndex) : []}
              key={message.id}
            />
          ))}
        </div>
      ) : (
        <p className={styles.lead}>이 문항에는 제출한 답변이 없습니다.</p>
      )}
    </div>
  );
}

function QuestionScoreBreakdown({ review }: { review: InterviewQuestionReview }) {
  const answerScore = typeof review.answerScore === "number" ? review.answerScore : review.score;
  const followUpScores = Array.isArray(review.followUpScores) ? review.followUpScores : [];
  return (
    <article className={styles.scoreBreakdown}>
      <div>
        <span>질문 답변 점수</span>
        <strong>{answerScore}<small>/100점</small></strong>
      </div>
      {followUpScores.length ? (
        followUpScores.map((item) => (
          <div key={item.followUpIndex}>
            <span>꼬리질문 {item.followUpIndex} 답변 점수</span>
            <strong>{item.score}<small>/100점</small></strong>
            {item.summary ? <p>{cleanDisplayText(item.summary) || item.summary}</p> : null}
          </div>
        ))
      ) : (
        <p>답변한 꼬리질문이 없어서 꼬리질문 점수는 아직 없습니다.</p>
      )}
    </article>
  );
}

function ResultConversationMessage({
  message,
  ncsAreas = [],
}: {
  message: InterviewMessage;
  ncsAreas?: InterviewQuestion["ncsAreas"];
}) {
  const content = cleanDisplayText(message.content) || message.content;
  const label = message.role === "answer"
    ? "내 답변"
    : message.role === "follow_up"
      ? `면접관 꼬리질문 ${message.followUpIndex || ""}`
      : "AI 질문";

  return (
    <article className={`${styles.chatBubble} ${message.role === "answer" ? styles.chatAnswer : ""} ${message.role === "follow_up" ? styles.chatFollow : ""}`}>
      <strong>{label}</strong>
      {message.role === "answer" ? (
        <textarea
          className={styles.savedAnswer}
          value={content}
          readOnly
          aria-label="제출한 답변"
        />
      ) : (
        <p>{content}</p>
      )}
      {message.role === "follow_up" && ncsAreas.length ? (
        <div className={styles.badgeList}>
          {ncsAreas.map((area) => <span key={area}>{area}</span>)}
        </div>
      ) : null}
      {message.feedback ? (
        <div className={styles.feedback}>
          <b>{cleanDisplayText(message.feedback.summary) || message.feedback.summary}</b>
          {message.feedback.nextAnswerGuide ? (
            <p>{cleanDisplayText(message.feedback.nextAnswerGuide) || message.feedback.nextAnswerGuide}</p>
          ) : null}
          <ul>
            {cleanDisplayList(message.feedback.strengths).slice(0, 2).map((item) => <li key={`s-${item}`}>{item}</li>)}
            {cleanDisplayList(message.feedback.improvements).slice(0, 2).map((item) => <li key={`i-${item}`}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function getFollowUpNcsAreas(messages: InterviewMessage[], messageIndex: number) {
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "answer") {
      return uniqueNcsAreas(message.feedback?.followUpNcsAreas || []);
    }
  }
  return [];
}

function uniqueNcsAreas(values: string[]) {
  const validNames = new Set(NCS_AREA_NAMES);
  return Array.from(new Set(values.filter((value): value is NcsAreaName => validNames.has(value as NcsAreaName))));
}

function hasQuestionAnswer(messages: InterviewMessage[], questionId: string) {
  return messages.some((message) => message.questionId === questionId && message.role === "answer");
}

function formatQuestionType(type: InterviewQuestion["type"]) {
  switch (type) {
    case "experience":
      return "경험면접";
    case "situation":
      return "상황면접";
    case "job":
      return "직무면접";
    case "personality":
      return "인성면접";
    case "ethics":
      return "직업윤리";
    default:
      return "면접";
  }
}

function cleanDisplayText(value?: string | null) {
  return (value || "")
    .replace(/\b[A-Z]\d{6}\b/gi, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/([\/|,])\s*([\/|,])+/g, "$1")
    .replace(/^\s*[\/|,]\s*|\s*[\/|,]\s*$/g, "")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*\|\s*/g, " / ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanDisplayList(items: string[]) {
  return Array.from(new Set(items.map(cleanDisplayText).filter(Boolean)));
}
