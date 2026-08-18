"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import type { CoachingFeedback, CoachingFramework, CoachingHistoryItem, CoachingQuestionReview, CoachingReviewSeverity } from "../coaching.dto";
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
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  const result = item.result;
  const review = makeSubmissionReview(result, item);
  const title = item.job?.title || "제출한 자소서";

  return <div className={styles.page}>
    <AppHeader />
    <main className={`${styles.frame} ${styles.newResultScreen}`}>
      <h1>Ai NCS 자소서 코칭 결과</h1>
      <p className={styles.newResultSubtitle}>{title} 기준 분석 결과</p>

      <section className={styles.submittedBlock}>
        <h2>제출한 자소서</h2>
        {item.inputType === "file"
          ? <div className={styles.submittedFile}><span className={styles.fileDocIcon} aria-hidden="true" />내가 제출한 자소서<small>{item.sourceFilename || item.inputText || "첨부 파일"}</small></div>
          : <details className={styles.submittedDetails}><summary><span className={styles.fileDocIcon} aria-hidden="true" />내가 제출한 자소서 펼쳐보기</summary><p>{item.inputText}</p></details>}
      </section>

      <section className={styles.reviewStats} aria-label="코칭 요약">
        <ReviewStat label="제출 전 확인" value={review.preSubmitChecks} tone="check" />
        <ReviewStat label="고치면 좋은 곳" value={review.fixSuggestions} tone="fix" />
        <ReviewStat label="그대로 두세요" value={review.keepCount} tone="keep" />
      </section>

      <section className={styles.questionListBlock}>
        <h2>자소서 리스트</h2>
        <div className={styles.questionList}>
          {review.questions.map((question, index) => <a key={`${question.question}-${index}`} href={`#coaching-question-${index + 1}`}>
            <span>문항 {index + 1}</span>
            <strong>{question.question}</strong>
            <em>{question.frameworks.join(" · ")} · {question.editCount}개 첨삭</em>
          </a>)}
        </div>
      </section>

      <TermsExplanation />

      <section className={styles.questionReviewList}>
        {review.questions.map((question, index) => <QuestionReview key={`${question.question}-${index}`} question={question} index={index} />)}
      </section>

      <div className={styles.resultActions}>
        <button type="button" onClick={() => router.push("/ai-tools/coaching")}>다시 코칭받기</button>
        <button type="button" onClick={() => setSaveAlertOpen(true)}>결과 저장</button>
      </div>
    </main>
    <AppFooter active="ai" />
    {saveAlertOpen ? <SaveCompleteAlert onConfirm={() => router.push("/ai-tools/coaching")} /> : null}
  </div>;
}

function ReviewStat({ label, value, tone }: { label: string; value: number; tone: "check" | "fix" | "keep" }) {
  return <article className={`${styles.reviewStat} ${styles[`reviewStat_${tone}`]}`}><strong>{value}</strong><span>{label}</span></article>;
}

function QuestionReview({ question, index }: { question: CoachingQuestionReview; index: number }) {
  const over = question.exceededBy > 0;
  return <article id={`coaching-question-${index + 1}`} className={styles.questionReview}>
    <header>
      <span>문항 {index + 1}</span>
      <h2>{question.question}</h2>
      <p>{question.characterLimit ? `${question.characterCount.toLocaleString()} / ${question.characterLimit.toLocaleString()}자` : `${question.characterCount.toLocaleString()}자`}</p>
    </header>
    <div className={`${styles.charNotice} ${over ? styles.charOver : styles.charOk}`}>
      {over ? `${question.exceededBy.toLocaleString()}자 초과입니다. 이대로는 입력창에 들어가지 않습니다. 아래 첨삭에서 줄일 곳을 표시해 두었습니다.` : "글자 수 제한 안에 들어옵니다. 표현을 더 선명하게 다듬으면 좋아요."}
    </div>
    {question.resumeEvidence.length ? <div className={styles.resumeEvidence}><h3>이력서에서 확인한 근거</h3>{question.resumeEvidence.map((item) => <p key={item}>{item}</p>)}</div> : null}
    <div className={styles.methodTags}>{question.frameworks.map((framework) => <span key={framework}>{framework}</span>)}</div>
    <p className={styles.methodComment}>{question.methodComment}</p>
    <div className={styles.answerCard}>{renderHighlightedText(question.answer, question.highlights)}</div>
    <div className={styles.editCards}>{question.edits.map((edit) => <section key={`${edit.index}-${edit.title}`} className={styles.editCard}>
      <h3><b>{edit.frameworkPart}</b><span className={styles[`editTone_${edit.severity}`]}>{edit.title}</span></h3>
      <p>{edit.issue}</p>
      <strong>{edit.suggestion}</strong>
      {edit.replacement ? <em>{edit.replacement}</em> : null}
    </section>)}</div>
    <Legend />
  </article>;
}

function TermsExplanation() {
  return <section className={styles.resultTermsInfo}>
    <h2>왜 이 틀로 첨삭하나요?</h2>
    <MethodRow method="PREP" title="주장 → 이유 → 사례 → 재강조">지원동기·가치관·포부처럼 생각과 판단을 묻는 문항. 조직이해와 직업윤리 항목에서 판단 근거를 봅니다.</MethodRow>
    <MethodRow method="CAR" title="배경 → 행동 → 결과">프로젝트·직무 경험처럼 성과를 짧게 보여야 하는 문항. 분량이 빠듯할 때 상황 설명을 줄이는 데 유리합니다.</MethodRow>
    <MethodRow method="PAP" title="문제 → 접근 → 해결">갈등·위기·문제해결 문항. 문제해결능력과 대인관계능력을 볼 때 평가자는 문제를 어떻게 정의했는지부터 봅니다.</MethodRow>
    <MethodRow method="STAR" title="상황 → 과제 → 행동 → 결과">위 셋에 딱 맞지 않는 일반 경험형 문항의 기본값. 면접관 교육에서 가장 널리 쓰이는 구조입니다.</MethodRow>
    <p className={styles.resultTermsNote}>이 네 가지는 기관이 공개한 채점표가 아닙니다. 다만 NCS 자소서에서 자주 평가되는 직업기초능력과 경험 서술 방식을 기준으로, 제출 전 스스로 점검할 수 있게 정리한 틀입니다. 모든 지적에 원문을 그대로 인용해 두었으니, 동의가 안 되는 지적은 넘기셔도 됩니다.</p>
  </section>;
}

function MethodRow({ method, title, children }: { method: CoachingFramework; title: string; children: ReactNode }) {
  return <div className={styles.methodRow}><b>{method}</b><div><strong>{title}</strong><p>{children}</p></div></div>;
}

function Legend() {
  return <div className={styles.newLegend}><span className={styles.legendCheck}>제출 전 확인</span><span className={styles.legendFix}>고치면 좋은 곳</span><span className={styles.legendKeep}>그대로 두세요</span></div>;
}

function renderHighlightedText(text: string, highlights: CoachingQuestionReview["highlights"]) {
  const source = text.trim();
  const ranges = highlights.map((highlight, index) => {
    const range = findTextRange(source, highlight.original);
    return range ? { ...range, severity: highlight.severity, index } : null;
  }).filter(Boolean).sort((a, b) => a!.start - b!.start) as Array<{ start: number; end: number; severity: CoachingReviewSeverity; index: number }>;
  if (!ranges.length) return source;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) parts.push(source.slice(cursor, range.start));
    parts.push(<span key={`${range.start}-${range.index}`} className={`${styles.newHighlight} ${styles[`newHighlight_${range.severity}`]}`}>{source.slice(range.start, range.end)}</span>);
    cursor = range.end;
  }
  if (cursor < source.length) parts.push(source.slice(cursor));
  return parts;
}

function findTextRange(text: string, target: string) {
  const exact = text.indexOf(target);
  if (exact >= 0) return { start: exact, end: exact + target.length };
  const normalizedText = normalizeForMatch(text);
  const normalizedTarget = normalizeForMatch(target).text.trim();
  const start = normalizedText.text.indexOf(normalizedTarget);
  if (start < 0) return null;
  const end = start + normalizedTarget.length - 1;
  return { start: normalizedText.map[start], end: normalizedText.map[end] + 1 };
}

function normalizeForMatch(value: string) {
  let text = "";
  const map: number[] = [];
  let previousSpace = false;
  Array.from(value).forEach((char, index) => {
    if (/\s/.test(char)) {
      if (previousSpace) return;
      text += " ";
      map.push(index);
      previousSpace = true;
    } else {
      text += char;
      map.push(index);
      previousSpace = false;
    }
  });
  return { text, map };
}

function makeSubmissionReview(result: CoachingFeedback, item: ResultSource) {
  if (result.submissionReview?.questions?.length) return result.submissionReview;
  const source = item.inputType === "file" ? result.originalTextExcerpt || item.inputText || "첨부한 자소서 원문을 기준으로 분석했습니다." : item.inputText;
  const highlights = result.sentenceEdits.slice(0, 4).filter((edit) => edit.original && source.includes(edit.original)).map((edit) => ({ original: edit.original, severity: edit.good ? "keep" as const : "fix" as const, label: edit.good ? "그대로 두세요" : "고치면 좋은 곳", note: edit.reason }));
  const question: CoachingQuestionReview = {
    question: "자소서 문항",
    answer: source || result.originalTextExcerpt || "",
    characterLimit: null,
    characterCount: Array.from((source || "").replace(/\s/g, "")).length,
    exceededBy: 0,
    frameworks: ["PREP"],
    editCount: highlights.length,
    methodComment: "제출한 자소서 전체 흐름을 기준으로 첨삭했어요.",
    resumeEvidence: [],
    highlights,
    edits: highlights.map((highlight, index) => ({ index: index + 1, frameworkPart: "P · 주장", severity: highlight.severity, title: highlight.label, issue: highlight.note, suggestion: highlight.severity === "keep" ? "이 표현은 유지해도 좋습니다." : "직무와 연결되는 근거를 더 구체적으로 보완해 주세요." })),
  };
  return { preSubmitChecks: 0, fixSuggestions: highlights.filter((item) => item.severity === "fix").length, keepCount: highlights.filter((item) => item.severity === "keep").length, questions: [question] };
}

function SaveCompleteAlert({ onConfirm }: { onConfirm: () => void }) {
  return <div className={styles.saveAlertOverlay} role="dialog" aria-modal="true" aria-labelledby="coaching-save-alert-title"><section className={styles.saveAlertBox}><div className={styles.saveAlertVisual}><Image src="/coaching/coaching-save-alert-bg.svg" alt="" width={184} height={111} className={styles.saveAlertBg} /><Image src="/coaching/coaching-save-alert-owl.png" alt="" width={202} height={168} className={styles.saveAlertImage} priority /></div><h2 id="coaching-save-alert-title">축하드립니다~!</h2><p>코칭 결과가 저장되었습니다.</p><button type="button" onClick={onConfirm}>확인</button></section></div>;
}
