"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCurrentUser, getJobPostings } from "@/features/home/home.api";
import { listResumes } from "@/features/my/my.api";
import { getDiagnosisResultHistory, selectDiagnosisResult } from "@/features/diagnosis/diagnosis.api";
import type { DiagnosisResultHistoryItemDto } from "@/features/diagnosis/diagnosis.dto";
import type { ResumeDto } from "@/features/my/my.dto";
import { coachResume } from "../coaching.api";
import type { CoachingFeedback, CoachingJob } from "../coaching.dto";
import styles from "./CoachingPage.module.css";

export function CoachingPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [inputType, setInputTypeState] = useState<"text" | "file">("text");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<CoachingJob | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeDto[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisResultHistoryItemDto[]>([]);
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState<string | null>(null);
  const [hasDiagnosis, setHasDiagnosis] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState(false);
  const [feedback, setFeedback] = useState<CoachingFeedback | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [picker, setPicker] = useState<"diagnosis" | "resume" | null>(null);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<CoachingJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    Promise.all([getCurrentUser().catch(() => null), listResumes().catch(() => null), getDiagnosisResultHistory(undefined, 20).catch(() => null)]).then(([user, resumeResponse, diagnosisResponse]) => {
      setHasDiagnosis(Boolean(user?.user?.diagnosisResultId));
      const nextResumes = resumeResponse?.resumes || [];
      const selected = nextResumes.find((item) => item.isSelected) || nextResumes[0];
      setResumes(nextResumes);
      setHasResume(Boolean(selected));
      setResumeId(selected?.id || null);
      setDiagnoses(diagnosisResponse?.items || []);
      setSelectedDiagnosisId(diagnosisResponse?.selectedResultId || user?.user?.diagnosisResultId || null);
      setLoading(false);
    });
  }, []);

  const searchJobs = async () => {
    setSearching(true);
    try {
      const result = await getJobPostings({ query, limit: 20 });
      setJobs(result.items.map((item) => ({ id: item.id, institutionName: item.institutionName, title: item.title, applicationEndAt: item.applicationEndAt })));
    } finally { setSearching(false); }
  };

  const handleFile = (nextFile: File | null) => {
    if (!nextFile) return;
    if (nextFile.size > 10 * 1024 * 1024) return setError("10MB 이하 파일만 업로드할 수 있습니다.");
    setError("");
    setFile(nextFile);
  };

  const selectDiagnosis = async (item: DiagnosisResultHistoryItemDto) => {
    await selectDiagnosisResult(item.resultId);
    setSelectedDiagnosisId(item.resultId);
    setHasDiagnosis(true);
    setPicker(null);
  };

  const changeInputType = (nextType: "text" | "file") => {
    if (nextType === inputType) return;
    const hasCurrentInput = inputType === "text" ? Boolean(text.trim()) : Boolean(file);
    if (hasCurrentInput && !window.confirm("입력하신 내용이 삭제됩니다 변경하시겠습니까?")) return;
    if (inputType === "text") {
      setText("");
    } else {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setInputTypeState(nextType);
  };

  const setInputType = (nextType: "text" | "file") => changeInputType(nextType);

  const submit = async () => {
    if (!hasDiagnosis) return setError("강점·성향 진단을 먼저 완료해 주세요.");
    if (!hasResume) return setError("이력서를 먼저 등록해 주세요.");
    if (inputType === "text" && !text.trim()) return setError("자소서를 입력해 주세요.");
    if (inputType === "file" && !file) return setError("자소서 파일을 첨부해 주세요.");
    setError(""); setCoaching(true);
    try {
      const result = await coachResume({ inputType, inputText: inputType === "file" ? file?.name || "" : text, file, jobPostingId: job?.id, resumeId });
      setFileName(file?.name || null); setFeedback(result.feedback); router.push(`/ai-tools/coaching/result/${result.resultId}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "코칭에 실패했습니다."); }
    finally { setCoaching(false); }
  };

  if (feedback) return <CoachingResult feedback={feedback} job={job} inputType={inputType} fileName={fileName} onRetry={() => setFeedback(null)} />;
  if (coaching) return <CoachingLoadingScreen />;

  return <div className={styles.page}>
    <AppHeader />
    <main className={styles.frame}>
      <h1>Ai NCS 자소서 코칭</h1>
      <section className={styles.intro}><strong>자소서를 Ai가 코칭해드려요</strong><p>총평 · 문항별 피드백 · 개선 예시까지 한 번에 확인하세요.</p></section>
      {job ? <div className={styles.selectedJob}><span>{job.institutionName}</span><strong>{job.title}</strong><button type="button" onClick={() => { setJob(null); setJobPickerOpen(true); }} aria-label="연결 공고 변경">변경</button></div> : <><button className={styles.jobConnect} type="button" onClick={() => setJobPickerOpen(true)}>+ 지원 공고 연결하기 (선택)</button><p className={styles.helper}>공고를 연결하면 해당 직무에 맞춰 더 정확하게 코칭해요.<br />연결하지 않아도 일반 자소서 코칭을 받을 수 있어요.</p></>}
      <StatusCard title="강점·성향 진단 결과" ready={hasDiagnosis} empty="현재 강·약점 결과가 없습니다." action="진단 시작하기 →" href="/ai-tools/diagnosis" onChange={() => setPicker("diagnosis")} selected={diagnoses.find((item) => item.resultId === selectedDiagnosisId)?.typeName} date={formatDiagnosisDate(diagnoses.find((item) => item.resultId === selectedDiagnosisId)?.completedAt)} />
      <StatusCard title="내 이력서" ready={hasResume} empty="현재 등록된 이력서가 없습니다." action="이력서 등록하기 →" href="/my/resumes/new" onChange={() => setPicker("resume")} selected={resumes.find((item) => item.id === resumeId)?.file?.originalFilename || resumes.find((item) => item.id === resumeId)?.title} />
      <section className={styles.writeSection}><h2>자소서 작성</h2><div className={styles.tabs}><button className={inputType === "text" ? styles.tabActive : ""} type="button" onClick={() => setInputType("text")}>직접 입력하기</button><button className={inputType === "file" ? styles.tabActive : ""} type="button" onClick={() => setInputType("file")}>파일 첨부</button></div>{inputType === "text" ? <><textarea value={text} maxLength={10000} onChange={(event) => setText(event.target.value)} placeholder="작성한 자기소개서를 항목 구분 없이 통째로 붙여넣어 주세요. (예: 지원동기, 성장과정, 입사 후 포부 등이 모두 포함된 전체 글)" /><span className={styles.counter}>{text.length.toLocaleString()}자 / 10,000자</span></> : <button type="button" className={`${styles.fileDrop} ${isDragActive ? styles.fileDropActive : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragActive(true); }} onDragLeave={() => setIsDragActive(false)} onDrop={(event) => { event.preventDefault(); setIsDragActive(false); handleFile(event.dataTransfer.files?.[0] || null); }}><input ref={fileInputRef} type="file" accept=".hwp,.hwpx,.pdf,.doc,.docx" onChange={(event) => handleFile(event.target.files?.[0] || null)} />{file ? <strong>{file.name}</strong> : <><span className={styles.fileSheetIcon} aria-hidden="true" /><strong>파일을 선택하거나 여기에 끌어다 놓으세요</strong><span>HWP · HWPX · PDF · DOC · DOCX (최대 10MB)</span></>}</button>}</section>
      {inputType === "file" && file ? <button type="button" className={styles.fileRemoveButton} onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>첨부 파일 제거 ×</button> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.primaryButton} type="button" onClick={submit} disabled={coaching || loading}>Ai NCS 자소서 코칭 받기</button>
    </main><AppFooter active="ai" />
    {jobPickerOpen ? <JobPicker query={query} setQuery={setQuery} jobs={jobs} searching={searching} onSearch={searchJobs} onPick={(item) => { setJob(item); setJobPickerOpen(false); }} onClose={() => setJobPickerOpen(false)} /> : null}
    {picker === "diagnosis" ? <DiagnosisPicker items={diagnoses} selectedId={selectedDiagnosisId} onPick={selectDiagnosis} onClose={() => setPicker(null)} /> : null}
    {picker === "resume" ? <ResumePicker items={resumes} selectedId={resumeId} onPick={(item) => { setResumeId(item.id); setHasResume(true); setPicker(null); }} onClose={() => setPicker(null)} /> : null}
  </div>;
}

function CoachingLoadingScreen() {
  return <div className={`${styles.page} ${styles.coachingLoadingPage}`}><main className={styles.coachingLoadingFrame} aria-live="polite" aria-busy="true"><Image src="/coaching/coaching-loading-owl.png" alt="" width={114} height={140} priority className={styles.coachingLoadingImage} /><h1>데이터 분석중입니다...</h1><p>Ai 자소서 코칭을 진행중이에요.</p><div className={styles.coachingLoadingTrack} aria-hidden="true"><span /></div></main></div>;
}

function StatusCard({ title, ready, empty, action, href, onChange, selected, date }: { title: string; ready: boolean; empty: string; action: string; href: string; onChange: () => void; selected?: string; date?: string }) {
  return <section className={styles.statusSection}><div className={styles.sectionHeading}><h2>{title}</h2>{ready ? <button type="button" onClick={onChange}>변경</button> : null}</div>{ready ? <div className={styles.readyCard}><strong>{selected || "등록된 정보가 있어요."}</strong>{date ? <p>{date}</p> : null}</div> : <div className={styles.emptyCard}><p>{empty}<br />{title === "내 이력서" ? "이력서를 등록하세요." : "강·약점 테스트를 진행하세요."}</p><Link href={href}>{action}</Link></div>}</section>;
}

function JobPicker({ query, setQuery, jobs, searching, onSearch, onPick, onClose }: { query: string; setQuery: (value: string) => void; jobs: CoachingJob[]; searching: boolean; onSearch: () => void; onPick: (job: CoachingJob) => void; onClose: () => void }) {
  return <div className={styles.overlay}><section className={styles.modal}><header><h2>지원 공고 연결하기</h2><button type="button" onClick={onClose}>×</button></header><p>기업명이나 공고명을 검색해 주세요. 마감된 공고는 표시되지 않아요.</p><div className={styles.search}><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSearch()} placeholder="기업명 또는 공고명" /><button type="button" onClick={onSearch}>검색</button></div><div className={styles.jobResults}>{searching ? <p>공고를 찾는 중...</p> : jobs.length ? jobs.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)}><span>{item.institutionName}</span><strong>{item.title}</strong><small>~ {item.applicationEndAt ? new Date(item.applicationEndAt).toLocaleDateString("ko-KR") : "상시채용"}</small></button>) : <p>검색 결과가 없습니다.</p>}</div></section></div>;
}

function DiagnosisPicker({ items, selectedId, onPick, onClose }: { items: DiagnosisResultHistoryItemDto[]; selectedId: string | null; onPick: (item: DiagnosisResultHistoryItemDto) => void; onClose: () => void }) {
  return <div className={styles.overlay}><section className={styles.modal}><div className={styles.sheetHandle} /><header><h2>강점·성향 진단 결과</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.pickerList}>{items.map((item) => <button type="button" key={item.resultId} className={styles.pickerCard} onClick={() => onPick(item)}><span><strong>{item.typeName}</strong><small>{new Date(item.completedAt).toLocaleDateString("ko-KR")}</small></span>{item.resultId === selectedId ? <b className={styles.selectedLabel}>선택됨 ✓</b> : <em>선택하기</em>}</button>)}</div></section></div>;
}

function ResumePicker({ items, selectedId, onPick, onClose }: { items: ResumeDto[]; selectedId: string | null; onPick: (item: ResumeDto) => void; onClose: () => void }) {
  return <div className={styles.overlay}><section className={styles.modal}><div className={styles.sheetHandle} /><header><h2>내 이력서 선택</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.pickerList}>{items.map((item) => <button type="button" key={item.id} className={styles.pickerCard} onClick={() => onPick(item)}><span><strong>{item.title}</strong><small>{new Date(item.updatedAt || item.createdAt).toLocaleDateString("ko-KR")}</small></span>{item.id === selectedId ? <b className={styles.selectedLabel}>선택됨 ✓</b> : <em>선택하기</em>}</button>)}</div></section></div>;
}

function CoachingResult({ feedback, job, inputType, fileName, onRetry }: { feedback: CoachingFeedback; job: CoachingJob | null; inputType: "text" | "file"; fileName: string | null; onRetry: () => void }) {
  const router = useRouter();
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  const usedEdits = new Set<string>();
  const jobConnection = feedback.jobConnection || {
    title: "직무 연결성",
    status: "needs_work" as const,
    feedback: feedback.questionFeedback.find((item) => item.question !== "전체 문항")?.feedback || "지원 직무와 자소서 경험의 연결을 확인해 보세요.",
    suggestion: feedback.questionFeedback.find((item) => item.question !== "전체 문항")?.suggestion || "공고의 자격요건과 연결되는 경험을 구체적으로 제시해 보세요.",
    sentenceEdits: [],
  };
  const originalText = feedback.originalTextExcerpt || "제출한 자소서 원문을 기준으로 분석했습니다.";
  const sections = [{ ...jobConnection, sentenceEdits: balanceDisplayEdits("직무 연결성", uniqueSentenceEdits(jobConnection.sentenceEdits, usedEdits), originalText, usedEdits) }, ...["지원동기", "경험 서술", "입사 후 포부"].map((title) => {
    const section = feedback.sections.find((item) => item.title === title) || { title, status: "needs_work" as const, feedback: "", suggestion: "", sentenceEdits: [] };
    return { ...section, sentenceEdits: balanceDisplayEdits(title, uniqueSentenceEdits(section.sentenceEdits, usedEdits), originalText, usedEdits) };
  })];
  return <div className={styles.page}><AppHeader /><main className={`${styles.frame} ${styles.resultScreen}`}><Link href="/ai-tools/coaching" className={styles.back}>‹ 자소서 코칭</Link><h1>Ai NCS 자소서 코칭 결과</h1>{job ? <div className={styles.resultJob}><span>{job.institutionName}</span><strong>{job.title}</strong></div> : null}<section className={styles.submitted}><h2>제출한 자소서</h2>{inputType === "file" ? <div className={styles.fileResult}><span>📝 내가 제출한 자소서</span><small>{fileName || "첨부 파일"}</small></div> : <details><summary>📝 내가 제출한 자소서</summary><p className={styles.submittedText}>직접 입력한 자소서 원문은 결과 기록에 저장되었습니다.</p></details>}</section><section className={styles.scoreCard}><span className={styles.gradeBadge}>{feedback.grade} · {gradeMessage(feedback.grade)}</span><b>{feedback.score}<small>/100</small></b><p>{feedback.summary}</p></section><ResultList title="세부 평가" scores={feedback.evaluationScores} /><section className={styles.resultSection}><h2>문항별 피드백</h2>{sections.map((section) => <FeedbackSection key={section.title} section={section} sourceText={originalText} />)}</section><section className={`${styles.resultSection} ${styles.rewriteSection}`}><h2>개선 예시문</h2><p>제출한 자소서를 지원 공고에 맞춰 다시 썼어요.</p><div className={styles.rewriteCard}><p className={styles.originalRewrite}>{originalText}</p><p className={styles.improvedRewrite}>{feedback.rewrittenText}</p></div></section><div className={styles.resultActions}><button type="button" onClick={onRetry}>다시 코칭받기</button><button type="button" onClick={() => setSaveAlertOpen(true)}>결과 저장</button></div></main><AppFooter active="ai" />{saveAlertOpen ? <SaveCompleteAlert onConfirm={() => router.push("/ai-tools/coaching")} /> : null}</div>;
}

function SaveCompleteAlert({ onConfirm }: { onConfirm: () => void }) {
  return <div className={styles.saveAlertOverlay} role="dialog" aria-modal="true" aria-labelledby="coaching-save-alert-title"><section className={styles.saveAlertBox}><div className={styles.saveAlertVisual}><Image src="/coaching/coaching-save-alert-bg.svg" alt="" width={184} height={111} className={styles.saveAlertBg} /><Image src="/coaching/coaching-save-alert-owl.png" alt="" width={202} height={168} className={styles.saveAlertImage} priority /></div><h2 id="coaching-save-alert-title">축하드립니다~!</h2><p>코칭 결과가 저장되었습니다.</p><button type="button" onClick={onConfirm}>확인</button></section></div>;
}

function FeedbackSection({ section, sourceText }: { section: { title: string; status?: "good" | "needs_work"; feedback: string; suggestion?: string; sentenceEdits?: Array<{ original: string; improved: string; reason: string; good?: boolean }> }; sourceText: string }) {
  const editSourceText = buildSentenceEditSource(sourceText, section.sentenceEdits || []);
  return <article className={styles.feedbackSection}><h3>{section.title} <span className={`${styles.statusBadge} ${section.status === "good" ? styles.statusGood : styles.statusNeeds}`}>{section.status === "good" ? "좋아요" : "보완 필요"}</span></h3><p>{section.feedback}</p><div className={styles.suggestionBox}><SectionLabel>개선 제안</SectionLabel><p>{formatExampleText(section.suggestion || "공고의 요구사항과 연결되는 근거를 더 구체적으로 작성해 보세요.")}</p></div><div className={styles.sentenceEdit}><SectionLabel>문장별 첨삭</SectionLabel>{section.sentenceEdits?.length ? <SentenceHighlights sourceText={editSourceText} edits={section.sentenceEdits} /> : <p className={styles.emptyEdit}>분석된 문장별 첨삭이 없습니다.</p>}</div><div className={styles.annotationLegend}><span className={styles.needsLegend}>보완이 필요한 표현</span><span className={styles.goodLegend}>잘 쓴 표현</span></div></article>;
}
function SectionLabel({ children }: { children: string }) { return <h4><span className={styles.coachingPencilIcon} aria-hidden="true">✍</span>{children}</h4>; }
function SentenceHighlights({ sourceText, edits }: { sourceText: string; edits: Array<{ original: string; improved: string; reason: string; good?: boolean }> }) { return <p className={styles.sentenceEditText}>{renderHighlightedText(sourceText, edits)}</p>; }
function renderHighlightedText(sourceText: string, edits: Array<{ original: string; good?: boolean }>) {
  const text = sourceText.trim();
  const ranges = edits
    .map((edit, index) => {
      const target = edit.original.trim();
      const range = target ? findTextRange(text, target) : null;
      return range ? { ...range, good: Boolean(edit.good), index } : null;
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
function uniqueSentenceEdits(edits: Array<{ original: string; improved: string; reason: string; good?: boolean }> = [], used: Set<string>) { return edits.filter((edit) => { const key = edit.original.replace(/\s+/g, " ").trim(); if (!key || used.has(key)) return false; used.add(key); return true; }); }
function balanceDisplayEdits(title: string, edits: Array<{ original: string; improved: string; reason: string; good?: boolean }>, source: string, used: Set<string>) { const next = [...edits]; if (!next.some((item) => !item.good)) { const needs = makeDisplayFallbackEdit(title, source, used, false); if (needs) next.unshift(needs); } if (!next.some((item) => item.good)) { const good = makeDisplayFallbackEdit(title, source, used, true); if (good) next.push(good); } return next.slice(0, 5); }
function makeDisplayFallbackEdit(title: string, source: string, used: Set<string>, good: boolean) { const patterns: Record<string, RegExp> = { "직무 연결성": /자격|직무|업무|경력|전기|소방|기계|시설|관리|점검|분석|수행/, "지원동기": /지원|동기|관심|기관|회사|직무|선택|기여|공공|안전/, "경험 서술": /경험|프로젝트|성과|분석|작성|수행|담당|개선|결과|데이터|보고서|관리/, "입사 후 포부": /입사|기여|목표|계획|수행|역할|포부|노력|배우|성장/ }; const sentences = source.split(/\n|(?<=[.!?。])\s+/).map((item) => item.replace(/^[-•\d.\s]+/, "").trim()).filter((item) => item.length >= 12); const picked = [...sentences.filter((item) => patterns[title]?.test(item)), ...sentences].find((item) => !used.has(item.replace(/\s+/g, " ").trim())); if (!picked) return null; used.add(picked.replace(/\s+/g, " ").trim()); return { original: picked.slice(0, 180), improved: "", reason: good ? "지원자의 강점이 드러나는 표현입니다." : "공고와 연결되는 근거를 더 구체화할 수 있는 표현입니다.", good }; }
function formatExampleText(value: string) { const text = value.trim(); return /^예\s*[:：]/.test(text) ? text : `예: ${text}`; }
function ResultList({ title, scores }: { title: string; scores: Array<{ label: string; score: number }> }) { return <section className={styles.resultSection}><h2>{title}</h2><div className={styles.evaluationList}>{scores.map((item) => <div className={styles.evaluationItem} key={item.label}><strong>{item.label}<b>{item.score}점</b></strong><div className={styles.evaluationTrack}><span style={{ width: `${item.score}%` }} /></div></div>)}</div></section>; }
function gradeMessage(grade: CoachingFeedback["grade"]) { return ({ "A+": "구조와 직무 연결이 매우 탄탄해요.", "A-": "좋은 흐름이에요. 구체적인 근거를 조금 더 보강해 보세요.", "B+": "핵심은 잘 전달돼요. 경험과 결과를 더 선명하게 다듬어 보세요.", "B-": "좋은 소재가 있어요. 문단 구조부터 차근차근 정리해 보세요.", "C+": "방향은 보이지만 핵심 근거가 부족해요.", "C-": "지원 직무 기준으로 다시 정리할 필요가 있어요.", "D+": "내용 대부분을 공고에 맞춰 다시 써야 해요.", "D-": "제출 전 전면 수정이 필요해요.", F: "현재 상태로는 다시 작성이 필요해요." })[grade]; }
function formatDiagnosisDate(value?: string) { return value ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)).replace(/\. /g, ". ").replace(/\.$/, "") : ""; }
