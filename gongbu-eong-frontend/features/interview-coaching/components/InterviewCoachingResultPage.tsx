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
  const resultQuestions = answeredQuestions;
  const selectedQuestion =
    resultQuestions.find((question) => question.id === activeQuestionId) ||
    resultQuestions[0] ||
    null;
  const selectedMessages = selectedQuestion
    ? filterAnsweredConversation(
      session.messages.filter((message) => message.questionId === selectedQuestion.id),
    )
    : [];
  const selectedReview = selectedQuestion
    ? result.questionReviews.find((review) => review.questionId === selectedQuestion.id)
    : null;
  const scoredAnswerCount = getScoredAnswerCount(result);
  const downloadResultPdf = async () => {
    const target = pdfCaptureRef.current;
    if (!target) return;
    const previousStyle = target.getAttribute("style");
    try {
      const { toJpeg } = await import("html-to-image");
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
      const captureHeight = target.scrollHeight || target.offsetHeight;
      if (!captureHeight) throw new Error("다운로드할 결과 영역을 찾지 못했습니다.");
      const dataUrl = await toJpeg(target, {
        cacheBust: true,
        pixelRatio: 1,
        quality: 0.92,
        backgroundColor: "#ffffff",
        width: captureWidth,
        height: captureHeight,
        style: {
          margin: "0",
          transform: "none",
        },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `ncs-interview-coaching-${session.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
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
          questions={resultQuestions}
          messages={session.messages}
          activeQuestionId={activeQuestionId}
          onSelect={setActiveQuestionId}
          getQuestionLabel={(question) => `Q${session.questions.findIndex((item) => item.id === question.id) + 1}`}
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
        <em className={styles.scoreBasis}>답변한 원 질문/꼬리질문 {scoredAnswerCount}개 점수를 100점 만점 기준으로 평균 환산</em>
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

      <InterviewAnalysisView session={session} mode="ncs" ncsTitle="NCS 직무/관련 영역 매핑" />

      <div ref={pdfCaptureRef} className={styles.pdfCapture} aria-hidden="true">
        <ResultPdfDocument
          session={session}
          result={result}
          strengths={strengths}
          improvements={improvements}
          futurePracticeQuestions={futurePracticeQuestions}
          answeredQuestions={resultQuestions}
          scoredAnswerCount={scoredAnswerCount}
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
      <article className={styles.questionCard} data-pdf-block>
        <div className={styles.resultSkillList}>
          {ncsAreas.map((area) => <span key={area}>{formatNcsArea(area)}</span>)}
        </div>
        <div className={styles.questionMeta}>
          <span>질문 {questionIndex + 1} · {question.difficulty} · {formatQuestionType(question.type)}</span>
        </div>
        <h2>{formatReadableText(question.question)}</h2>
        <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDim}`}>질문 의도</span>
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
    <article className={`${styles.chatBubble} ${message.role === "answer" ? styles.chatAnswer : ""} ${message.role === "follow_up" ? styles.chatFollow : ""} ${message.role === "answer" && answerTone === "follow_up" ? styles.chatFollowAnswer : ""}`} data-pdf-block>
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
        <>
          <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDim}`}>질문 의도</span>
          <p className={styles.promptGuide}>{formatReadableText(guide)}</p>
        </>
      ) : null}
      {message.feedback ? (
        <div className={styles.feedback}>
          <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDark}`}>평가 요약</span>
          <b>{formatReadableText(message.feedback.summary)}</b>
          {message.feedback.nextAnswerGuide || message.feedback.improvements.length ? (
            <>
              <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDim}`}>보완점</span>
              {message.feedback.nextAnswerGuide ? (
                <p>{formatReadableText(message.feedback.nextAnswerGuide)}</p>
              ) : null}
              {message.feedback.improvements.length ? (
                <ul>
                  {cleanDisplayList(message.feedback.improvements).slice(0, 3).map((item) => <li key={`i-${item}`}>{item}</li>)}
                </ul>
              ) : null}
            </>
          ) : null}
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
  scoredAnswerCount,
}: {
  session: InterviewCoachingSession;
  result: NonNullable<InterviewCoachingSession["result"]>;
  strengths: string[];
  improvements: string[];
  futurePracticeQuestions: string[];
  answeredQuestions: InterviewQuestion[];
  scoredAnswerCount: number;
}) {
  const displayPositionName = cleanDisplayText(session.positionName) || session.positionName;
  return (
    <div className={styles.pdfDocument}>
      <h1 data-pdf-block>AI NCS 면접 코칭 결과</h1>
      <section className={styles.resultSection}>
        <h2 data-pdf-block>문항별 답변 코칭</h2>
        {answeredQuestions.map((question) => {
          const questionIndex = session.questions.findIndex((item) => item.id === question.id);
          const messages = filterAnsweredConversation(
            session.messages.filter((message) => message.questionId === question.id),
          );
          const review = result.questionReviews.find((item) => item.questionId === question.id);
          return (
            <article className={styles.pdfQuestionBlock} key={question.id}>
              <div className={styles.pdfQuestionLabel} data-pdf-block>
                <strong>Q{questionIndex + 1}</strong>
                <span>질문 {questionIndex + 1} · {question.difficulty} · {formatQuestionType(question.type)}</span>
              </div>
              <ResultPdfQuestionDetail
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
        <div data-pdf-block>
          <h2>최종 평가</h2>
          <span>{session.companyName} · {displayPositionName}</span>
          <strong>{result.score}<small>/100점</small></strong>
          <em className={styles.scoreBasis}>답변한 원 질문/꼬리질문 {scoredAnswerCount}개 점수를 100점 만점 기준으로 평균 환산</em>
        </div>
        {splitPdfText(result.summary).map((chunk, index) => (
          <p className={styles.pdfTextChunk} data-pdf-block key={`summary-${index}`}>{chunk}</p>
        ))}
      </section>
      <ResultPdfListSection title="잘한 점" items={strengths} />
      <ResultPdfListSection title="보완할 점" items={improvements} />
      <ResultPdfListSection title="추가 연습 질문" items={futurePracticeQuestions} />
      <ResultPdfProfileAnalysis session={session} />
      <ResultPdfNcsAnalysis session={session} />
    </div>
  );
}

function ResultPdfListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className={styles.resultSection}>
      <h2 data-pdf-block>{title}</h2>
      <ul className={styles.pdfList}>
        {items.map((item, index) => (
          splitPdfText(item).map((chunk, chunkIndex) => (
            <li data-pdf-block key={`${title}-${index}-${chunkIndex}`}>
              {chunkIndex === 0 ? `${index + 1}. ${chunk}` : chunk}
            </li>
          ))
        ))}
      </ul>
    </section>
  );
}

function ResultPdfProfileAnalysis({ session }: { session: InterviewCoachingSession }) {
  const profile = session.analysis.profile;
  const displayPositionName = cleanDisplayText(session.positionName) || session.positionName;
  const displayPostingTitle = cleanDisplayText(session.job?.title) || displayPositionName;
  const displayDutyText = cleanDisplayText(session.dutyText) || session.dutyText;
  const displayKeywords = compactPdfKeywords(profile.keywords, [
    session.companyName,
    displayPositionName,
    displayDutyText,
  ]);
  const displayMainTasks = cleanDisplayList(profile.mainTasks);
  const displayKnowledge = cleanDisplayList([
    ...profile.requiredKnowledge,
    ...profile.preferredExperience,
  ]).slice(0, 5);

  return (
    <section className={styles.profileCard}>
      <div className={styles.profileHeader} data-pdf-block>
        <span>직무내역 분석</span>
        <strong>{displayPostingTitle}</strong>
        <p>{displayDutyText}</p>
        {displayKeywords.length ? (
          <div className={styles.keywordList}>
            {displayKeywords.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : null}
      </div>
      <div className={styles.profileGrid}>
        <article data-pdf-block>
          <h3>주요 업무</h3>
          <ul>{(displayMainTasks.length ? displayMainTasks : ["연결한 공고 기준으로 직무 정보를 분석 중입니다."]).map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article data-pdf-block>
          <h3>필요 지식/경험</h3>
          <ul>{(displayKnowledge.length ? displayKnowledge : ["연결한 공고 기준으로 직무 정보를 분석 중입니다."]).map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>
    </section>
  );
}

function ResultPdfQuestionDetail({
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
      <article className={styles.questionCard} data-pdf-block>
        <div className={styles.resultSkillList}>
          {ncsAreas.map((area) => <span key={area}>{formatNcsArea(area)}</span>)}
        </div>
        <div className={styles.questionMeta}>
          <span>질문 {questionIndex + 1} · {question.difficulty} · {formatQuestionType(question.type)}</span>
        </div>
        <h2>{formatReadableText(question.question)}</h2>
        <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDim}`}>질문 의도</span>
        <p>{formatReadableText(question.intent)}</p>
      </article>

      {messages.map((message, messageIndex) => {
        const answerScore = getAnswerMessageScore(message, messages, messageIndex, review);
        const answerTone: ResultAnswerTone = getAnswerFollowUpIndex(message, messages, messageIndex)
          ? "follow_up"
          : "main";
        return (
          <ResultPdfConversationMessage
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

      {review ? (
        <article className={styles.reviewCard} data-pdf-block>
          <strong>문항 종합 코칭</strong>
          <p>{formatReadableText(review.summary)}</p>
        </article>
      ) : null}
    </div>
  );
}

function ResultPdfConversationMessage({
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
  const chunks = splitPdfText(formatReadableText(message.content));
  const guideChunks = splitPdfText(formatReadableText(guide));
  const improvementChunks = message.feedback
    ? [
      ...splitPdfText(formatReadableText(message.feedback.nextAnswerGuide)),
      ...cleanDisplayList(message.feedback.improvements).slice(0, 3),
    ].filter(Boolean)
    : [];
  const label = message.role === "answer"
    ? "내 답변"
    : message.role === "follow_up"
      ? "면접관 꼬리질문"
      : "AI 질문";
  const isFollowAnswer = message.role === "answer" && answerTone === "follow_up";

  return (
    <article className={`${styles.pdfMessage} ${message.role === "follow_up" ? styles.pdfFollowMessage : ""} ${isFollowAnswer ? styles.pdfFollowAnswer : ""}`}>
      <div className={styles.pdfMessageHeader} data-pdf-block>
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
      </div>
      {chunks.map((chunk, index) => (
        <p
          className={message.role === "answer" ? styles.pdfAnswerChunk : styles.pdfTextChunk}
          data-pdf-block
          key={`${message.id}-content-${index}`}
        >
          {chunk}
        </p>
      ))}
      {guideChunks.map((chunk, index) => (
        index === 0 ? (
          <div data-pdf-block key={`${message.id}-guide-${index}`}>
            <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDim}`}>질문 의도</span>
            <p className={styles.pdfGuideChunk}>{chunk}</p>
          </div>
        ) : (
          <p className={styles.pdfGuideChunk} data-pdf-block key={`${message.id}-guide-${index}`}>
            {chunk}
          </p>
        )
      ))}
      {message.feedback ? (
        <>
          <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDark}`} data-pdf-block>평가 요약</span>
          {splitPdfText(formatReadableText(message.feedback.summary)).map((chunk, index) => (
            <p className={styles.pdfFeedbackChunk} data-pdf-block key={`${message.id}-summary-${index}`}>
              {chunk}
            </p>
          ))}
          {improvementChunks.length ? (
            <span className={`${styles.resultInfoPill} ${styles.resultInfoPillDim}`} data-pdf-block>보완점</span>
          ) : null}
          {improvementChunks.map((chunk, index) => (
            <p className={styles.pdfFeedbackChunk} data-pdf-block key={`${message.id}-feedback-${index}`}>
              {chunk}
            </p>
          ))}
        </>
      ) : null}
    </article>
  );
}

function ResultPdfNcsAnalysis({ session }: { session: InterviewCoachingSession }) {
  const visibleMappings = [...session.analysis.ncsMappings].sort((left, right) => right.relevance - left.relevance);
  return (
    <>
      <section className={`${styles.sectionTitle} ${styles.ncsSectionTitle}`} data-pdf-block>
        <h2>NCS 직무/관련 영역 매핑</h2>
        <small>{visibleMappings.length}개 매칭</small>
      </section>
      <section className={styles.ncsPanel}>
        {visibleMappings.map((item) => (
          <article className={styles.ncsItem} key={item.name}>
            <div className={styles.pdfNcsHeader} data-pdf-block>
              <strong>{formatNcsArea(item.name)}<b>{item.relevance}%</b></strong>
              <div className={styles.track} aria-hidden="true"><span style={{ width: `${item.relevance}%` }} /></div>
            </div>
            {splitPdfText(formatReadableText(item.reason)).map((chunk, index) => (
              <p data-pdf-block key={`${item.name}-${index}`}>{chunk}</p>
            ))}
          </article>
        ))}
        {!visibleMappings.length ? (
          <p data-pdf-block>AI가 생성한 NCS 매핑 결과가 없습니다.</p>
        ) : null}
      </section>
    </>
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
  const relevantMessages = messages.filter((item) => item.role === "answer" || item.role === "follow_up");
  return relevantMessages.filter((message, index) => {
    if (message.role === "answer") return true;
    const nextMessage = relevantMessages
      .slice(index + 1)
      .find((item) => item.role === "answer" || item.role === "follow_up");
    return nextMessage?.role === "answer";
  });
}

function uniqueNcsAreas(values: string[]) {
  const validNames = new Set(NCS_AREA_NAMES);
  return Array.from(new Set(values.filter((value): value is NcsAreaName => validNames.has(value as NcsAreaName))));
}

function hasQuestionAnswer(messages: InterviewMessage[], questionId: string) {
  return messages.some((message) => message.questionId === questionId && message.role === "answer");
}

function getScoredAnswerCount(result: NonNullable<InterviewCoachingSession["result"]>) {
  return result.questionReviews.reduce(
    (count, review) => count + 1 + review.followUpScores.length,
    0,
  );
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
    .replace(/(^|\s+)(?=(?:\d+[.)]\s|[①②③④⑤⑥⑦⑧⑨⑩]\s))/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])\s+(?=(실제|우선|예를|다음|전기|면접|질문|응답|이후|첫|둘|셋|넷|다섯|마지막|특히|다만|현재|지금|방금|최종|각|그|이|저))/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanDisplayList(items: string[]) {
  return Array.from(new Set(items.map(cleanDisplayText).filter(Boolean)));
}

function splitPdfText(value?: string | null, maxLength = 520) {
  const text = formatReadableText(value);
  if (!text) return [];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);

  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= maxLength) {
      chunks.push(paragraph);
      return;
    }

    const sentences = paragraph
      .split(/(?<=[.!?。]|[다요죠까음임함됨됨니다십시오세요])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    let current = "";

    sentences.forEach((sentence) => {
      if (!current) {
        current = sentence;
        return;
      }
      if (`${current}\n${sentence}`.length <= maxLength) {
        current = `${current}\n${sentence}`;
        return;
      }
      chunks.push(current);
      current = sentence;
    });

    if (current) chunks.push(current);
  });

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength * 1.4) return [chunk];
    const pieces: string[] = [];
    for (let index = 0; index < chunk.length; index += maxLength) {
      pieces.push(chunk.slice(index, index + maxLength).trim());
    }
    return pieces.filter(Boolean);
  });
}

function compactPdfKeywords(items: string[], excludedValues: string[]) {
  const excludedTexts = excludedValues.map((item) => cleanDisplayText(item).replace(/\s/g, "")).filter(Boolean);
  return cleanDisplayList(items)
    .filter((item) => {
      const compactItem = item.replace(/\s/g, "");
      return !excludedTexts.some((excluded) => excluded && (compactItem === excluded || excluded.includes(compactItem)));
    })
    .slice(0, 8);
}
