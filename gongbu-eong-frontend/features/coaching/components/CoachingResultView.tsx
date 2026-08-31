"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import type { CoachingFeedback, CoachingFramework, CoachingHistoryItem, CoachingQuestionReview } from "../coaching.dto";
import styles from "./CoachingPage.module.css";

type ResultSource = {
  inputType: "text" | "file";
  inputText: string;
  sourceFilename: string | null;
  job: CoachingHistoryItem["job"];
  result: CoachingFeedback;
};

export function CoachingResultView({ item }: { item: ResultSource }) {
  const router = useRouter();
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [revisionMode, setRevisionMode] = useState<"original" | "compare">("original");
  const questionTabsRef = useRef<HTMLDivElement>(null);
  const questionTabsDragRef = useRef({ active: false, moved: false, scrollLeft: 0, startX: 0, suppressClick: false, targetIndex: null as number | null });
  const result = item.result;
  const review = makeSubmissionReview(result, item);
  const selectedQuestion = review.questions[selectedQuestionIndex] || review.questions[0];
  const subtitle = item.job?.institutionName ? `${item.job.institutionName} · NCS 분석 + AI 첨삭` : "NCS 분석 + AI 첨삭";
  const selectQuestion = (index: number) => {
    setSelectedQuestionIndex(index);
    setRevisionMode("original");
  };
  const handleQuestionTabsPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const tabs = questionTabsRef.current;
    if (!tabs || tabs.scrollWidth <= tabs.clientWidth || (event.pointerType === "mouse" && event.button !== 0)) return;
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("button[data-question-index]") : null;
    const targetIndex = button ? Number(button.dataset.questionIndex) : null;
    questionTabsDragRef.current = {
      active: true,
      moved: false,
      scrollLeft: tabs.scrollLeft,
      startX: event.clientX,
      suppressClick: false,
      targetIndex: Number.isInteger(targetIndex) ? targetIndex : null,
    };
    tabs.setPointerCapture(event.pointerId);
    tabs.classList.add(styles.questionTabsDragging);
  };
  const handleQuestionTabsPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const tabs = questionTabsRef.current;
    const drag = questionTabsDragRef.current;
    if (!tabs || !drag.active) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 3) drag.moved = true;
    tabs.scrollLeft = drag.scrollLeft - deltaX;
    if (drag.moved) event.preventDefault();
  };
  const handleQuestionTabsPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const tabs = questionTabsRef.current;
    const drag = questionTabsDragRef.current;
    if (!tabs || !drag.active) return;
    drag.active = false;
    tabs.classList.remove(styles.questionTabsDragging);
    if (tabs.hasPointerCapture(event.pointerId)) tabs.releasePointerCapture(event.pointerId);
    if (drag.moved) {
      drag.suppressClick = true;
      window.setTimeout(() => {
        questionTabsDragRef.current.suppressClick = false;
      }, 0);
    } else if (event.type !== "pointercancel" && drag.targetIndex !== null) {
      selectQuestion(drag.targetIndex);
    }
  };
  const handleQuestionTabsClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!questionTabsDragRef.current.suppressClick) return;
    questionTabsDragRef.current.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return <div className={styles.page}>
    <AppHeader />
    <main className={`${styles.frame} ${styles.figmaResultScreen}`}>
      <h1>AI NCS 자소서 코칭 결과</h1>
      <p className={styles.figmaResultSubtitle}>{subtitle}</p>
      <ScoreSummary result={result} />
      <InsightCards strongest={review.strongestQuestion} priority={review.priorityImprovement} />
      <EvaluationBars scores={result.evaluationScores} />

      <section className={styles.questionTabSection}>
        <h2>자소서 문항</h2>
        <div
          ref={questionTabsRef}
          className={styles.questionTabs}
          role="tablist"
          aria-label="자소서 문항 선택"
          onPointerDown={handleQuestionTabsPointerDown}
          onPointerMove={handleQuestionTabsPointerMove}
          onPointerUp={handleQuestionTabsPointerEnd}
          onPointerCancel={handleQuestionTabsPointerEnd}
          onClickCapture={handleQuestionTabsClickCapture}
        >
          {review.questions.map((question, index) => <button key={`${question.question}-${index}`} type="button" role="tab" aria-selected={selectedQuestionIndex === index} data-question-index={index} className={selectedQuestionIndex === index ? styles.questionTabActive : ""} onClick={() => selectQuestion(index)}>
            <span>{index + 1}.</span>{question.tabTitle || makeTabTitle(question.question)}
          </button>)}
        </div>
      </section>

      {selectedQuestion ? <section className={styles.figmaQuestionArea}>
        <h2>{selectedQuestionIndex + 1}. {selectedQuestion.tabTitle || makeTabTitle(selectedQuestion.question)}</h2>
        <article className={styles.figmaQuestionCard}>
          <div className={styles.figmaQuestionMark}>Q{selectedQuestionIndex + 1}</div>
          <strong>{selectedQuestion.question}</strong>
          <div>
            {getNcsBadges(selectedQuestion).map((badge) => <span key={badge}>{badge}</span>)}
          </div>
        </article>
        <div className={styles.figmaDetailCard}>
          <NcsEvaluation question={selectedQuestion} />
          <CoachingPoints question={selectedQuestion} />
          <StructureChecks question={selectedQuestion} />
          <section className={styles.revisionSection}>
            <h2>AI 첨삭 제안</h2>
            <p>핵심 메시지는 유지하고, 문항 의도와 NCS 기준에 맞춰 표현을 정리했어요.</p>
            <p className={styles.figmaRevisionNote}>새로운 경험·수치·성과는 임의로 추가하지 않았습니다.</p>
            <div className={styles.revisionTabs}>
              <button type="button" className={revisionMode === "original" ? styles.revisionTabActive : ""} onClick={() => setRevisionMode("original")}>원문</button>
              <button type="button" className={revisionMode === "compare" ? styles.revisionTabActive : ""} onClick={() => setRevisionMode("compare")}>비교</button>
            </div>
            {revisionMode === "original" ? <div className={styles.originalTextPanel}>{selectedQuestion.answer}</div> : <ComparisonList question={selectedQuestion} />}
            <MetaReview question={selectedQuestion} />
          </section>
        </div>
        <OverallAssessment assessment={review.overallAssessment} />
        <section className={styles.figmaScoreNotice}>
          ※ 점수는 공식 NCS 채점 점수가 아니라, 2026 NCS 직업공통능력을 참고해 자기소개서 표현 수준을 분석한 서비스용 AI 참고 점수입니다.
        </section>
      </section> : null}

      <div className={styles.resultActions}>
        <button type="button" onClick={() => router.push("/ai-tools/coaching")}>다시 코칭받기</button>
      </div>
    </main>
    <AppFooter active="ai" />
  </div>;
}

function ScoreSummary({ result }: { result: CoachingFeedback }) {
  return <section className={styles.resultScoreSummary}>
    <span>AI 종합 분석</span>
    <strong>{Math.round(result.score)}<small>/100</small></strong>
    <b>{makeScoreComment(result.score)}</b>
    <p>{result.summary}</p>
  </section>;
}

function InsightCards({ strongest, priority }: { strongest?: NonNullable<ReturnType<typeof makeSubmissionReview>["strongestQuestion"]>; priority?: NonNullable<ReturnType<typeof makeSubmissionReview>["priorityImprovement"]> }) {
  return <section className={styles.insightGrid}>
    <article><strong>가장 강한 문항</strong><span>{strongest ? `${strongest.questionIndex}번 · ${strongest.ncsName}` : "1번 · NCS 역량"}</span></article>
    <article><strong>우선 보완</strong><span>{priority ? `${priority.questionIndex}번 · ${priority.title}` : "1번 · 경험 근거"}</span></article>
  </section>;
}

function EvaluationBars({ scores }: { scores: CoachingFeedback["evaluationScores"] }) {
  return <section className={styles.resultEvaluation}>
    <h2>전체 평가</h2>
    <div className={styles.evaluationList}>
      {scores.map((item) => <div key={item.label} className={styles.evaluationItem}><strong>{item.label}<b>{Math.round(item.score)}점</b></strong><div className={styles.evaluationTrack}><span style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} /></div></div>)}
    </div>
  </section>;
}

function NcsEvaluation({ question }: { question: CoachingQuestionReview }) {
  const items = question.ncsEvaluations?.length ? question.ncsEvaluations : [{ name: "NCS 역량", comment: "문항 내용을 기준으로 AI가 판단한 역량입니다.", score: 70 }];
  return <section className={styles.ncsEvaluationBlock}>
    <h2>NCS 기준 평가</h2>
    {items.slice(0, 2).map((item) => <article key={item.name}><div><strong>{item.name}</strong><span>{Math.round(item.score)}</span></div><p>{item.comment}</p></article>)}
  </section>;
}

function CoachingPoints({ question }: { question: CoachingQuestionReview }) {
  const points = question.coachingPoints || { strengths: ["유지할 만한 표현이 있습니다."], improvements: ["근거를 더 구체적으로 보완해 주세요."], ncsSuggestions: ["NCS 기준과 연결되는 행동·결과를 드러내세요."] };
  return <section className={styles.coachingPointBlock}>
    <h2>코칭 포인트</h2>
    <PointList title="잘한 점" items={points.strengths} />
    <PointList title="보완할 점" items={points.improvements} />
    <PointList title="NCS 기준 제안" items={points.ncsSuggestions} />
  </section>;
}

function PointList({ title, items }: { title: string; items: string[] }) {
  return <article><strong>{title}</strong>{items.map((item) => <p key={item}>{item}</p>)}</article>;
}

function StructureChecks({ question }: { question: CoachingQuestionReview }) {
  const checks = question.structureChecks?.length ? question.structureChecks : defaultStructureChecks(question.frameworks);
  const preferredFramework = question.frameworks[0] || checks[0]?.framework || "PREP";
  const frameworkParts = getFrameworkPartNames(preferredFramework);
  const frameworkCheck = checks.find((item) => item.framework === preferredFramework);
  const items = frameworkParts.map((part, index) => ({
    framework: preferredFramework,
    part,
    status: index === 1 && frameworkCheck?.status === "needs_work" ? "needs_work" as const : "good" as const,
    comment: frameworkCheck?.comment || `${part} 단계가 문항 흐름 안에서 확인됩니다.`,
  }));
  return <section className={styles.structureBlock}>
    <h2>{preferredFramework} 구조 점검</h2>
    {items.map((item, index) => <article key={`${item.framework}-${index}`}><b>{getFrameworkLetter(item.framework, index)}</b><div><strong>{item.part}</strong><span className={item.status === "good" ? styles.structureGood : styles.structureNeeds}>{item.status === "good" ? "좋음" : "보완"}</span><p>{item.comment}</p></div></article>)}
  </section>;
}

function ComparisonList({ question }: { question: CoachingQuestionReview }) {
  const items = question.comparisonEdits?.length ? question.comparisonEdits : question.edits.filter((item) => item.replacement).map((item) => ({ original: item.issue, improved: item.replacement!, reason: item.suggestion }));
  return <div className={styles.comparisonList}>{items.length ? items.slice(0, 3).map((item, index) => <article key={`${item.original}-${index}`}><strong>{item.reason}</strong><div><span>원문</span><p>{item.original}</p><span>첨삭</span><p>{item.improved}</p></div></article>) : <p className={styles.emptyEdit}>비교할 첨삭 문장이 없습니다.</p>}</div>;
}

function MetaReview({ question }: { question: CoachingQuestionReview }) {
  return <section className={styles.metaReviewGrid}>
    <article><h3>주요 수정 3건</h3>{(question.majorRevisions || []).slice(0, 3).map((item, index) => <div key={item}><b>{index + 1}</b><p>{item}</p></div>)}</article>
    <article><h3>사실성 체크</h3>{(question.factualChecks || []).map((item) => <p key={item}>{item}</p>)}</article>
  </section>;
}

function OverallAssessment({ assessment }: { assessment?: NonNullable<ReturnType<typeof makeSubmissionReview>["overallAssessment"]> }) {
  return <section className={styles.overallAssessment}>
    <h2>전체 평가</h2>
    <article><strong>현재 강점</strong><p>{assessment?.strengths || "지원자의 경험과 태도가 드러나는 문장이 있습니다."}</p></article>
    <article><strong>가장 먼저 고칠 것</strong><p>{assessment?.firstFix || "공고의 직무 요구와 연결되는 구체적인 근거를 먼저 보완하세요."}</p></article>
    <article><strong>첨삭 원칙</strong><p>{assessment?.principle || "원문을 살리되 NCS 역량, 행동, 결과가 확인되도록 문장을 다듬는 것이 좋습니다."}</p></article>
  </section>;
}

function makeSubmissionReview(result: CoachingFeedback, item: ResultSource) {
  if (result.submissionReview?.questions?.length) return {
    preSubmitChecks: result.submissionReview.preSubmitChecks,
    fixSuggestions: result.submissionReview.fixSuggestions,
    keepCount: result.submissionReview.keepCount,
    strongestQuestion: result.submissionReview.strongestQuestion,
    priorityImprovement: result.submissionReview.priorityImprovement,
    overallAssessment: result.submissionReview.overallAssessment,
    questions: result.submissionReview.questions,
  };
  const source = item.inputType === "file" ? result.originalTextExcerpt || item.inputText || "첨부한 자소서 원문을 기준으로 분석했습니다." : item.inputText;
  const question: CoachingQuestionReview = {
    question: "자소서 문항",
    tabTitle: "자소서",
    answer: source || result.originalTextExcerpt || "",
    characterLimit: null,
    characterCount: Array.from((source || "").replace(/\s/g, "")).length,
    exceededBy: 0,
    frameworks: ["PREP"],
    editCount: result.sentenceEdits.length,
    methodComment: "제출한 자소서 전체 흐름을 기준으로 첨삭했어요.",
    resumeEvidence: [],
    ncsEvaluations: [{ name: "의사소통능력", comment: "문장 흐름과 표현을 기준으로 확인한 역량입니다.", score: result.score }],
    coachingPoints: { strengths: ["유지할 만한 표현이 있습니다."], improvements: result.improvementSuggestions.slice(0, 2), ncsSuggestions: ["문항 요구와 NCS 역량이 직접 연결되도록 보완하세요."] },
    structureChecks: defaultStructureChecks(["PREP"]),
    comparisonEdits: result.sentenceEdits.slice(0, 4).map((edit) => ({ original: edit.original, improved: edit.improved, reason: edit.reason })),
    majorRevisions: result.improvementSuggestions.slice(0, 3),
    factualChecks: ["수치, 기관명, 경험 기간이 실제 근거와 일치하는지 확인하세요."],
    highlights: [],
    edits: [],
  };
  return { preSubmitChecks: 0, fixSuggestions: result.improvementSuggestions.length, keepCount: result.sentenceEdits.filter((item) => item.good).length, questions: [question] };
}

function defaultStructureChecks(frameworks: CoachingFramework[]) {
  const selected = new Set(frameworks);
  return (["STAR", "PAP", "CAR", "PREP"] as CoachingFramework[]).map((framework) => ({
    framework,
    status: selected.has(framework) ? "good" as const : "needs_work" as const,
    comment: selected.has(framework) ? `${framework} 구조로 읽을 수 있는 흐름이 있습니다.` : `${framework} 구조로 보완하면 문항 의도가 더 선명해집니다.`,
  }));
}

function makeTabTitle(value: string) {
  return value.replace(/^\s*\d+\s*[.)]\s*/, "").replace(/\s+/g, "").slice(0, 8) || "자소서";
}

function makeScoreComment(score: number) {
  if (score >= 85) return "직무 적합성은 좋고,\n근거의 구체성을 더 보완해보세요.";
  if (score >= 70) return "기본 흐름은 좋고,\n문항별 근거를 더 보완해보세요.";
  return "핵심 방향은 잡혔고,\n직무 연결성을 먼저 보완해보세요.";
}

function getNcsBadges(question: CoachingQuestionReview) {
  const first = question.ncsEvaluations?.[0]?.name || "NCS 역량";
  const second = question.ncsEvaluations?.[1]?.name;
  const framework = question.frameworks[0] || "PREP";
  return [`핵심 NCS · ${first}`, second ? `보조 · ${second}` : "", `추천 · ${framework}`].filter(Boolean);
}

function getFrameworkLetter(framework: CoachingFramework, index: number) {
  const map: Record<CoachingFramework, string[]> = {
    PREP: ["P", "R", "E", "P"],
    CAR: ["C", "A", "R"],
    PAP: ["P", "A", "P"],
    STAR: ["S", "T", "A", "R"],
  };
  return map[framework][index] || framework[0];
}

function getFrameworkPartNames(framework: CoachingFramework) {
  const map: Record<CoachingFramework, string[]> = {
    PREP: ["Point", "Reason", "Example", "Point"],
    CAR: ["Context", "Action", "Result"],
    PAP: ["Purpose", "Ability", "Plan"],
    STAR: ["Situation", "Task", "Action", "Result"],
  };
  return map[framework];
}
