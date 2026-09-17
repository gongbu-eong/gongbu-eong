"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getInterviewCoachingSession } from "../interview-coaching.api";
import type { InterviewCoachingSession, InterviewMessage, InterviewQuestion, NcsAreaName } from "../interview-coaching.dto";
import { InterviewAnalysisView, QuestionTabs } from "./InterviewCoachingPage";
import styles from "./InterviewCoachingPage.module.css";

type InterviewQuestionReview = NonNullable<InterviewCoachingSession["result"]>["questionReviews"][number];
type ResultAnswerTone = "main" | "follow_up";
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
  const pdfCaptureRef = useRef<HTMLDivElement | null>(null);
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
  const answeredQuestions = session.questions.filter((question) => hasQuestionAnswer(session.messages, question.id));
  const selectedQuestion =
    session.questions.find((question) => question.id === activeQuestionId) ||
    session.questions[0] ||
    null;
  const selectedMessages = selectedQuestion
    ? filterAnsweredConversation(
      session.messages.filter((message) => message.questionId === selectedQuestion.id),
    )
    : [];
  const selectedReview = selectedQuestion
    ? result.questionReviews.find((review) => review.questionId === selectedQuestion.id)
    : null;
  const downloadResultPdf = async () => {
    const target = pdfCaptureRef.current;
    if (!target) return;
    const previousStyle = target.getAttribute("style");
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      target.style.position = "fixed";
      target.style.left = "0";
      target.style.top = "0";
      target.style.zIndex = "-1";
      target.style.width = "600px";
      target.style.background = "#ffffff";
      target.style.visibility = "visible";
      target.style.pointerEvents = "none";
      await document.fonts?.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const captureWidth = target.scrollWidth || 600;
      const captureHeight = target.scrollHeight;
      if (!captureHeight) {
        throw new Error("PDF로 변환할 결과 영역을 찾지 못했습니다.");
      }
      const dataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: captureWidth,
        height: captureHeight,
        style: {
          margin: "0",
          transform: "none",
        },
      });
      const image = new window.Image();
      image.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("PDF 이미지를 생성하지 못했습니다."));
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const imageHeight = (image.height * contentWidth) / image.width;
      const pageContentHeight = pageHeight - margin * 2;
      let offset = 0;
      while (offset < imageHeight) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", margin, margin - offset, contentWidth, imageHeight);
        offset += pageContentHeight;
      }
      pdf.save(`ncs-interview-coaching-${session.id}.pdf`);
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : "AI NCS 면접 코칭 결과를 다운로드하지 못했습니다.");
    } finally {
      if (previousStyle === null) {
        target.removeAttribute("style");
      } else {
        target.setAttribute("style", previousStyle);
      }
    }
  };

  return (
    <>
      <section className={styles.resultSection}>
        <h2>문항별 답변 코칭</h2>
        <QuestionTabs
          questions={session.questions}
          messages={session.messages}
          activeQuestionId={activeQuestionId}
          onSelect={setActiveQuestionId}
        />
        {selectedQuestion ? (
          <ResultQuestionDetail
            questionIndex={session.questions.findIndex((question) => question.id === selectedQuestion.id)}
            question={selectedQuestion}
            messages={selectedMessages}
            review={selectedReview}
          />
        ) : null}
      </section>

      <section className={styles.resultHero}>
        <h2>최종 평가</h2>
        <span>{session.companyName} · {displayPositionName}</span>
        <strong>{result.score}<small>/100점</small></strong>
        <p>{formatReadableText(result.summary)}</p>
      </section>

      <section className={styles.resultSection}>
        <h2>잘한 점</h2>
        <ul>{strengths.map((item) => <li key={item}>{formatReadableText(item)}</li>)}</ul>
      </section>

      <section className={styles.resultSection}>
        <h2>보완할 점</h2>
        <ul>{improvements.map((item) => <li key={item}>{formatReadableText(item)}</li>)}</ul>
      </section>

      <section className={styles.resultSection}>
        <h2>추가 연습 질문</h2>
        <ul>{futurePracticeQuestions.map((item) => <li key={item}>{formatReadableText(item)}</li>)}</ul>
      </section>

      <InterviewAnalysisView session={session} mode="profile" profileTitle="직무내역 분석" />

      <InterviewAnalysisView session={session} mode="ncs" ncsTitle="NCS 관련 영역 매핑" />

      <div ref={pdfCaptureRef} className={styles.pdfCapture} aria-hidden="true">
        <ResultPdfDocument
          session={session}
          result={result}
          strengths={strengths}
          improvements={improvements}
          futurePracticeQuestions={futurePracticeQuestions}
          answeredQuestions={answeredQuestions.length ? answeredQuestions : session.questions.slice(0, 1)}
        />
      </div>
      <button type="button" className={styles.resultDownloadButton} onClick={downloadResultPdf}>
        NCS 면접 코칭 결과 다운받기
      </button>
      <Link href="/ai-tools/interview-coaching" className={styles.resultBackButton}>
        NCS 면접 코칭 다시하기
      </Link>
    </>
  );
}

function ResultQuestionDetail({
  questionIndex,
  question,
  messages,
  review,
}: {
  questionIndex: number;
  question: InterviewQuestion;
  messages: InterviewMessage[];
  review: InterviewQuestionReview | null | undefined;
}) {
  const ncsAreas = review?.ncsAreas?.length ? review.ncsAreas : question.ncsAreas;

  return (
    <div className={styles.resultQuestionDetail}>
      <article className={styles.questionCard}>
        <div className={styles.resultSkillList}>
          {ncsAreas.map((area) => <span key={area}>{formatNcsArea(area)}</span>)}
        </div>
        <div className={styles.questionMeta}>
          <span>질문 {questionIndex + 1} · {question.difficulty} · {formatQuestionType(question.type)}</span>
        </div>
        <h2>{formatReadableText(question.question)}</h2>
        <p>{formatReadableText(question.intent)}</p>
      </article>

      {messages.length ? (
        <div className={styles.chatList}>
          {messages.map((message, messageIndex) => {
            const answerScore = getAnswerMessageScore(message, messages, messageIndex, review);
            const answerTone: ResultAnswerTone = getAnswerFollowUpIndex(message, messages, messageIndex)
              ? "follow_up"
              : "main";
            return (
              <ResultConversationMessage
                message={message}
                answerTone={answerTone}
                ncsAreas={message.role === "follow_up" ? getFollowUpNcsAreas(messages, messageIndex) : []}
                guide={message.role === "follow_up" ? getFollowUpGuide(messages, messageIndex) : ""}
                scoreLabel={answerScore?.label}
                score={answerScore?.score}
                followUpTotal={3}
                key={message.id}
              />
            );
          })}
        </div>
      ) : (
        <p className={styles.lead}>이 문항에는 제출한 답변이 없습니다.</p>
      )}

      {review ? (
        <article className={styles.reviewCard}>
          <strong>문항 종합 코칭</strong>
          <p>{formatReadableText(review.summary)}</p>
        </article>
      ) : null}
    </div>
  );
}

function ResultConversationMessage({
  message,
  answerTone,
  ncsAreas = [],
  guide,
  scoreLabel,
  score,
  followUpTotal,
}: {
  message: InterviewMessage;
  answerTone?: ResultAnswerTone;
  ncsAreas?: InterviewQuestion["ncsAreas"];
  guide?: string;
  scoreLabel?: string;
  score?: number;
  followUpTotal?: number;
}) {
  const content = formatReadableText(message.content);
  const label = message.role === "answer"
    ? "내 답변"
    : message.role === "follow_up"
      ? "면접관 꼬리질문"
      : "AI 질문";

  return (
    <article className={`${styles.chatBubble} ${message.role === "answer" ? styles.chatAnswer : ""} ${message.role === "follow_up" ? styles.chatFollow : ""} ${message.role === "answer" && answerTone === "follow_up" ? styles.chatFollowAnswer : ""}`}>
      {message.role === "follow_up" && ncsAreas.length ? (
        <div className={styles.resultSkillList}>
          {ncsAreas.map((area) => <span key={area}>{formatNcsArea(area)}</span>)}
        </div>
      ) : null}
      <strong>
        <span>{label}</span>
        {message.role === "follow_up" && message.followUpIndex ? (
          <em>꼬리질문 {message.followUpIndex}/{followUpTotal || 3}</em>
        ) : null}
      </strong>
      {message.role === "answer" && typeof score === "number" ? (
        <div className={styles.answerScoreBadge}>
          <span>{scoreLabel || "답변 점수"}</span>
          <b>{score}<small>/100점</small></b>
        </div>
      ) : null}
      {message.role === "answer" ? (
        <p className={styles.savedAnswerText}>{content}</p>
      ) : (
        <p>{content}</p>
      )}
      {message.role === "follow_up" && guide ? (
        <p className={styles.promptGuide}>{formatReadableText(guide)}</p>
      ) : null}
      {message.feedback ? (
        <div className={styles.feedback}>
          <b>{formatReadableText(message.feedback.summary)}</b>
          {message.feedback.nextAnswerGuide ? (
            <p>{formatReadableText(message.feedback.nextAnswerGuide)}</p>
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

function ResultPdfDocument({
  session,
  result,
  strengths,
  improvements,
  futurePracticeQuestions,
  answeredQuestions,
}: {
  session: InterviewCoachingSession;
  result: NonNullable<InterviewCoachingSession["result"]>;
  strengths: string[];
  improvements: string[];
  futurePracticeQuestions: string[];
  answeredQuestions: InterviewQuestion[];
}) {
  const displayPositionName = cleanDisplayText(session.positionName) || session.positionName;
  return (
    <div className={styles.pdfDocument}>
      <h1>AI NCS 면접 코칭 결과</h1>
      <section className={styles.resultSection}>
        <h2>문항별 답변 코칭</h2>
        {answeredQuestions.map((question) => {
          const questionIndex = session.questions.findIndex((item) => item.id === question.id);
          const messages = filterAnsweredConversation(
            session.messages.filter((message) => message.questionId === question.id),
          );
          const review = result.questionReviews.find((item) => item.questionId === question.id);
          return (
            <article className={styles.pdfQuestionBlock} key={question.id}>
              <ResultQuestionDetail
                questionIndex={questionIndex}
                question={question}
                messages={messages}
                review={review}
              />
            </article>
          );
        })}
      </section>
      <section className={styles.resultHero}>
        <h2>최종 평가</h2>
        <span>{session.companyName} · {displayPositionName}</span>
        <strong>{result.score}<small>/100점</small></strong>
        <p>{formatReadableText(result.summary)}</p>
      </section>
      <section className={styles.resultSection}>
        <h2>잘한 점</h2>
        <ul>{strengths.map((item) => <li key={item}>{formatReadableText(item)}</li>)}</ul>
      </section>
      <section className={styles.resultSection}>
        <h2>보완할 점</h2>
        <ul>{improvements.map((item) => <li key={item}>{formatReadableText(item)}</li>)}</ul>
      </section>
      <section className={styles.resultSection}>
        <h2>추가 연습 질문</h2>
        <ul>{futurePracticeQuestions.map((item) => <li key={item}>{formatReadableText(item)}</li>)}</ul>
      </section>
      <InterviewAnalysisView session={session} mode="profile" profileTitle="직무내역 분석" />
      <InterviewAnalysisView session={session} mode="ncs" ncsTitle="NCS 관련 영역 매핑" />
    </div>
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

function getFollowUpGuide(messages: InterviewMessage[], messageIndex: number) {
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "answer") {
      return message.feedback?.nextAnswerGuide || "";
    }
  }
  return "";
}

function getAnswerMessageScore(
  message: InterviewMessage,
  messages: InterviewMessage[],
  messageIndex: number,
  review: InterviewQuestionReview | null | undefined,
) {
  if (message.role !== "answer") return null;
  const followUpIndex = getAnswerFollowUpIndex(message, messages, messageIndex);
  if (followUpIndex) {
    const followUpScore = review?.followUpScores?.find(
      (item) => item.followUpIndex === followUpIndex,
    );
    return {
      label: `꼬리질문 ${followUpIndex} 답변 점수`,
      score: followUpScore?.score ?? message.feedback?.score,
    };
  }
  return {
    label: "질문 답변 점수",
    score: review?.answerScore ?? message.feedback?.score,
  };
}

function getAnswerFollowUpIndex(
  message: InterviewMessage,
  messages: InterviewMessage[],
  messageIndex: number,
) {
  if (message.role !== "answer") return null;
  if (message.followUpIndex) return message.followUpIndex;
  const previousPrompt = findPreviousPromptMessage(messages, messageIndex);
  return previousPrompt?.role === "follow_up" && previousPrompt.followUpIndex
    ? previousPrompt.followUpIndex
    : null;
}

function findPreviousPromptMessage(messages: InterviewMessage[], answerIndex: number) {
  for (let index = answerIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "follow_up") return message;
    if (message.role === "answer") return null;
  }
  return null;
}

function formatNcsArea(value: string) {
  return value.replace("능력", " 능력");
}

function filterAnsweredConversation(messages: InterviewMessage[]) {
  return messages.filter((item) => item.role === "answer" || item.role === "follow_up");
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

function formatReadableText(value?: string | null) {
  const cleaned = cleanDisplayText(value);
  return cleaned
    .replace(/\s*(?=(?:\d+[\).]|[①②③④⑤⑥⑦⑧⑨⑩]))/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])\s+(?=(실제|우선|예를|다음|전기|면접|질문|응답|이후|첫|둘|셋|넷|다섯|마지막|특히|다만|현재|지금|방금|최종|각|그|이|저))/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanDisplayList(items: string[]) {
  return Array.from(new Set(items.map(cleanDisplayText).filter(Boolean)));
}
