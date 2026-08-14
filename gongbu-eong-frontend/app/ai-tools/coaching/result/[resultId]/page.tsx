"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCoachingResult } from "@/features/coaching/coaching.api";
import type { CoachingHistoryItem } from "@/features/coaching/coaching.dto";
import styles from "@/features/coaching/components/CoachingPage.module.css";

export default function CoachingResultPage() {
  const params = useParams<{ resultId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CoachingHistoryItem | null>(null);
  const [error, setError] = useState("");
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);

  useEffect(() => {
    if (!params.resultId) return;
    getCoachingResult(params.resultId)
      .then((response) => setItem(response.item))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "결과를 불러오지 못했습니다."));
  }, [params.resultId]);

  const result = item?.result;
  return <div className={styles.page}><AppHeader /><main className={`${styles.frame} ${styles.resultScreen}`}>
    {error ? <p className={styles.error}>{error}</p> : !result ? <p className={styles.loading}>결과를 불러오는 중...</p> : <>
      <h1>Ai NCS 자소서 코칭 결과</h1>
      {item.job ? <div className={styles.resultJob}><span>{item.job.institutionName}</span><strong>{item.job.title}</strong></div> : null}
      <section className={styles.submitted}><h2>제출한 자소서</h2>{item.inputType === "file" ? <div className={styles.fileResult}><span>📝 내가 제출한 자소서</span><small>{item.sourceFilename || item.inputText}</small></div> : <details><summary>📝 내가 제출한 자소서 펼쳐보기</summary><p className={styles.submittedText}>{item.inputText}</p></details>}</section>
      <section className={styles.scoreCard}><span className={styles.gradeBadge}>{result.grade} · {gradeLabel(result.grade)}</span><b>{result.score}<small>/100</small></b><p>{result.summary}</p></section>
      <ResultList title="세부 평가" scores={result.evaluationScores} />
      <section className={styles.resultSection}><h2>문항별 피드백</h2>{getDisplaySections(result).map((section) => <FeedbackSection key={section.title} section={section} sourceText={getOriginalTextForSentenceEdits(item)} />)}</section>
      {(() => { const rewrittenText = result.rewrittenText || result.sections.map((section) => section.example).filter(Boolean).join("\n\n"); const originalText = getOriginalTextForRewrite(item); return rewrittenText ? <section className={styles.resultSection}><h2>개선 예시문</h2><p>제출한 자소서를 지원 공고에 맞춰 AI가 다시 썼어요.</p><div className={styles.rewriteCard}><p className={styles.originalRewrite}>{originalText}</p><p className={styles.improvedRewrite}>{rewrittenText}</p></div></section> : null; })()}
      <div className={styles.resultActions}><button type="button" onClick={() => router.push("/ai-tools/coaching")}>다시 코칭받기</button><button type="button" onClick={() => setSaveAlertOpen(true)}>결과 저장</button></div>
    </>}
    </main><AppFooter active="ai" />{saveAlertOpen ? <SaveCompleteAlert onConfirm={() => router.push("/ai-tools/coaching")} /> : null}</div>;
}

function SaveCompleteAlert({ onConfirm }: { onConfirm: () => void }) {
  return <div className={styles.saveAlertOverlay} role="dialog" aria-modal="true" aria-labelledby="coaching-save-alert-title"><section className={styles.saveAlertBox}><div className={styles.saveAlertVisual}><Image src="/coaching/coaching-save-alert-bg.svg" alt="" width={184} height={111} className={styles.saveAlertBg} /><Image src="/coaching/coaching-save-alert-owl.png" alt="" width={202} height={168} className={styles.saveAlertImage} priority /></div><h2 id="coaching-save-alert-title">축하드립니다~!</h2><p>코칭 결과가 저장되었습니다.</p><button type="button" onClick={onConfirm}>확인</button></section></div>;
}

function getOriginalTextForRewrite(item: CoachingHistoryItem) {
  const resultText = item.result?.originalTextExcerpt?.trim();
  const storedText = item.inputText?.trim();
  if (resultText) return resultText;
  if (item.inputType !== "file" && storedText) return storedText;
  if (item.inputType === "file" && storedText && storedText !== item.sourceFilename) return storedText;
  return "첨부 파일 내부의 자기소개서 원문을 기준으로 분석했습니다.";
}

function getOriginalTextForSentenceEdits(item: CoachingHistoryItem) {
  const storedText = item.inputText?.trim();
  if (item.inputType !== "file" && storedText) return storedText;
  if (item.inputType === "file" && storedText && storedText !== item.sourceFilename) return storedText;
  return item.result?.originalTextExcerpt?.trim() || getOriginalTextForRewrite(item);
}

function getDisplaySections(result: NonNullable<CoachingHistoryItem["result"]>) {
  const usedEdits = new Set<string>();
  const sourceText = result.originalTextExcerpt || "제출한 자소서 원문을 기준으로 분석했습니다.";
  const jobConnection = result.jobConnection || { title: "직무 연결성", status: "needs_work" as const, feedback: result.questionFeedback.find((item) => item.question !== "전체 문항")?.feedback || "지원 직무와 자소서 경험의 연결을 확인해 보세요.", suggestion: result.questionFeedback.find((item) => item.question !== "전체 문항")?.suggestion || "공고의 자격요건과 연결되는 경험을 구체적으로 제시해 보세요.", sentenceEdits: [] };
  return [{ ...jobConnection, sentenceEdits: balanceDisplayEdits("직무 연결성", uniqueSentenceEdits(jobConnection.sentenceEdits, usedEdits), sourceText, usedEdits) }, ...["지원동기", "경험 서술", "입사 후 포부"].map((title) => {
    const section = result.sections.find((entry) => entry.title === title) || { title, status: "needs_work" as const, feedback: "", suggestion: "", sentenceEdits: [] };
    return { ...section, sentenceEdits: balanceDisplayEdits(title, uniqueSentenceEdits(section.sentenceEdits, usedEdits), sourceText, usedEdits) };
  })];
}

function FeedbackSection({ section, sourceText }: { section: { title: string; status?: "good" | "needs_work"; feedback: string; suggestion?: string; sentenceEdits?: Array<{ original: string; improved: string; reason: string; good?: boolean }> }; sourceText: string }) {
  const editSourceText = buildSentenceEditSource(sourceText, section.sentenceEdits || []);
  return <article className={styles.feedbackSection}><h3>{section.title} <span className={`${styles.statusBadge} ${section.status === "good" ? styles.statusGood : styles.statusNeeds}`}>{section.status === "good" ? "좋아요" : "보완 필요"}</span></h3><p>{section.feedback}</p><div className={styles.suggestionBox}><SectionLabel>개선 제안</SectionLabel><p>{formatExampleText(section.suggestion || "공고의 요구사항과 연결되는 근거를 더 구체적으로 작성해 보세요.")}</p></div><div className={styles.sentenceEdit}><SectionLabel>문장별 첨삭</SectionLabel>{section.sentenceEdits?.length ? <SentenceHighlights sourceText={editSourceText} edits={section.sentenceEdits} /> : <p className={styles.emptyEdit}>분석된 문장별 첨삭이 없습니다.</p>}</div><div className={styles.annotationLegend}><span className={styles.needsLegend}>보완이 필요한 표현</span><span className={styles.goodLegend}>잘 쓴 표현</span></div></article>;
}

function SectionLabel({ children }: { children: string }) {
  return <h4><span className={styles.coachingPencilIcon} aria-hidden="true">✍</span>{children}</h4>;
}

function SentenceHighlights({ sourceText, edits }: { sourceText: string; edits: Array<{ original: string; improved: string; reason: string; good?: boolean }> }) {
  return <p className={styles.sentenceEditText}>{renderHighlightedText(sourceText, edits)}</p>;
}

function renderHighlightedText(sourceText: string, edits: Array<{ original: string; good?: boolean }>) {
  const text = sourceText.trim();
  const ranges = edits
    .map((entry, index) => {
      const target = entry.original.trim();
      const range = target ? findTextRange(text, target) : null;
      return range ? { ...range, good: Boolean(entry.good), index } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.start - b!.start) as Array<{ start: number; end: number; good: boolean; index: number }>;
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start >= previous.end) merged.push(range);
  }
  if (!merged.length) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  merged.forEach((range) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(<span key={`${range.start}-${range.index}`} className={`${styles.sentenceHighlight} ${range.good ? styles.goodSentence : styles.needsSentence}`}>{text.slice(range.start, range.end)}</span>);
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function buildSentenceEditSource(sourceText: string, edits: Array<{ original: string }>) {
  const source = sourceText.trim();
  const targets = edits.map((edit) => edit.original.trim()).filter(Boolean);
  if (!targets.length) return source;
  const blocks = targets
    .map((target) => findTextRange(source, target))
    .filter(Boolean)
    .map((range) => expandToSentenceBlock(source, range!))
    .sort((a, b) => a.start - b.start);
  const merged = mergeTextBlocks(blocks);
  if (merged.length) return merged.map((block) => source.slice(block.start, block.end).trim()).join(" ");
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = target.replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join(" ");
}

function expandToSentenceBlock(text: string, range: { start: number; end: number }) {
  let start = range.start;
  let end = range.end;
  while (start > 0 && !isSentenceBoundary(text[start - 1])) start -= 1;
  while (start < range.start && /\s/.test(text[start])) start += 1;
  while (end < text.length && !isSentenceBoundary(text[end - 1])) end += 1;
  while (end < text.length && /\s/.test(text[end])) end += 1;
  return { start, end };
}

function isSentenceBoundary(char: string) {
  return /[.!?。！？\n]/.test(char);
}

function mergeTextBlocks(blocks: Array<{ start: number; end: number }>) {
  const merged: Array<{ start: number; end: number }> = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (previous && block.start <= previous.end) {
      previous.end = Math.max(previous.end, block.end);
    } else {
      merged.push({ ...block });
    }
  }
  return merged;
}

function findTextRange(text: string, target: string) {
  const exactStart = text.indexOf(target);
  if (exactStart >= 0) return { start: exactStart, end: exactStart + target.length };
  const source = normalizeForMatch(text);
  const needle = normalizeForMatch(target).text.trim();
  if (!needle) return null;
  const normalizedStart = source.text.indexOf(needle);
  if (normalizedStart < 0) return null;
  const normalizedEnd = normalizedStart + needle.length - 1;
  const start = source.map[normalizedStart];
  const end = source.map[normalizedEnd] + 1;
  return Number.isInteger(start) && Number.isInteger(end) && end > start ? { start, end } : null;
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
      return;
    }
    text += char;
    map.push(index);
    previousSpace = false;
  });
  return { text, map };
}

function uniqueSentenceEdits(edits: Array<{ original: string; improved: string; reason: string; good?: boolean }> = [], used: Set<string>) {
  return edits.filter((entry) => {
    const key = entry.original.replace(/\s+/g, " ").trim();
    if (!key || used.has(key)) return false;
    used.add(key);
    return true;
  });
}

function balanceDisplayEdits(title: string, edits: Array<{ original: string; improved: string; reason: string; good?: boolean }>, source: string, used: Set<string>) {
  const next = [...edits];
  if (!next.some((item) => !item.good)) {
    const needs = makeDisplayFallbackEdit(title, source, used, false);
    if (needs) next.unshift(needs);
  }
  if (!next.some((item) => item.good)) {
    const good = makeDisplayFallbackEdit(title, source, used, true);
    if (good) next.push(good);
  }
  return next.slice(0, 5);
}

function makeDisplayFallbackEdit(title: string, source: string, used: Set<string>, good: boolean) {
  const patterns: Record<string, RegExp> = { "직무 연결성": /자격|직무|업무|경력|전기|소방|기계|시설|관리|점검|분석|수행/, "지원동기": /지원|동기|관심|기관|회사|직무|선택|기여|공공|안전/, "경험 서술": /경험|프로젝트|성과|분석|작성|수행|담당|개선|결과|데이터|보고서|관리/, "입사 후 포부": /입사|기여|목표|계획|수행|역할|포부|노력|배우|성장/ };
  const sentences = source.split(/\n|(?<=[.!?。])\s+/).map((entry) => entry.replace(/^[-•\d.\s]+/, "").trim()).filter((entry) => entry.length >= 12);
  const picked = [...sentences.filter((entry) => patterns[title]?.test(entry)), ...sentences].find((entry) => !used.has(entry.replace(/\s+/g, " ").trim()));
  if (!picked) return null;
  used.add(picked.replace(/\s+/g, " ").trim());
  return { original: picked.slice(0, 180), improved: "", reason: good ? "지원자의 강점이 드러나는 표현입니다." : "공고와 연결되는 근거를 더 구체화할 수 있는 표현입니다.", good };
}

function formatExampleText(value: string) {
  const text = value.trim();
  return /^예\s*[:：]/.test(text) ? text : `예: ${text}`;
}

function ResultList({ title, scores }: { title: string; scores: Array<{ label: string; score: number }> }) {
  return <section className={styles.resultSection}><h2>{title}</h2><div className={styles.evaluationList}>{scores.map((item) => <div className={styles.evaluationItem} key={item.label}><strong>{item.label}<b>{item.score}점</b></strong><div className={styles.evaluationTrack}><span style={{ width: `${item.score}%` }} /></div></div>)}</div></section>;
}

function gradeLabel(grade: CoachingHistoryItem["result"] extends infer T ? T extends { grade: infer G } ? G : never : never) {
  return ({ "A+": "최상위 자소서", "A-": "우수한 자소서", "B+": "좋은 자소서", "B-": "보완하면 좋은 자소서", "C+": "개선 여지가 큰 자소서", "C-": "핵심 보완이 필요한 자소서", "D+": "전면 수정이 필요한 자소서", "D-": "기초부터 다시 다듬을 자소서", F: "다시 작성이 필요한 자소서" } as Record<string, string>)[String(grade)] || "분석 결과";
}
