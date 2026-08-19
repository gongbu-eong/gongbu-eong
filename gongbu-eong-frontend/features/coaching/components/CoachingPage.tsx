"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCurrentUser, getJobPostings } from "@/features/home/home.api";
import { getDiagnosisResultHistory, selectDiagnosisResult } from "@/features/diagnosis/diagnosis.api";
import type { DiagnosisResultHistoryItemDto } from "@/features/diagnosis/diagnosis.dto";
import { coachResume } from "../coaching.api";
import type { CoachingJob } from "../coaching.dto";
import styles from "./CoachingPage.module.css";

type QuestionRow = { id: string; question: string; characterLimit: string };
type ConnectedJob = CoachingJob & { duty: string };
const MAX_QUESTION_COUNT = 5;
const MIN_CHARACTER_LIMIT = 100;
const MAX_CHARACTER_LIMIT = 2000;

export function CoachingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loginRedirectedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [coaching, setCoaching] = useState(false);
  const [error, setError] = useState("");
  const [hasDiagnosis, setHasDiagnosis] = useState(false);
  const [diagnoses, setDiagnoses] = useState<DiagnosisResultHistoryItemDto[]>([]);
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([makeQuestionRow()]);
  const [inputType, setInputType] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [dutySheetJob, setDutySheetJob] = useState<CoachingJob | null>(null);
  const [connectedJob, setConnectedJob] = useState<ConnectedJob | null>(null);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<CoachingJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [picker, setPicker] = useState<"diagnosis" | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const user = await getCurrentUser().catch(() => null);
      if (!active) return;
      if (!user?.authenticated || !user.user) {
        if (!loginRedirectedRef.current) {
          loginRedirectedRef.current = true;
          window.alert("로그인이 필요한 서비스입니다.");
          router.replace("/login");
        }
        return;
      }
      const [diagnosisResponse] = await Promise.all([
        getDiagnosisResultHistory(undefined, 20).catch(() => null),
      ]);
      if (!active) return;
      setDiagnoses(diagnosisResponse?.items || []);
      setSelectedDiagnosisId(diagnosisResponse?.selectedResultId || user.user.diagnosisResultId || null);
      setHasDiagnosis(Boolean(user.user.diagnosisResultId || diagnosisResponse?.selectedResultId));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [router]);

  const searchJobs = async () => {
    setSearching(true);
    try {
      const result = await getJobPostings({ query, limit: 20, sort: "closing", employmentType: "정규직" });
      setJobs(result.items.filter((item) => !item.isClosed).map((item) => ({ id: item.id, institutionName: item.institutionName, title: item.title, applicationEndAt: item.applicationEndAt })));
    } finally {
      setSearching(false);
    }
  };

  const openJobPicker = () => {
    setJobPickerOpen(true);
    if (!jobs.length) void searchJobs();
  };

  const handleFile = (nextFile: File | null) => {
    if (!nextFile) return;
    if (nextFile.size > 10 * 1024 * 1024) return setError("10MB 이하 파일만 업로드할 수 있습니다.");
    const extension = nextFile.name.split(".").pop()?.toLowerCase() || "";
    if (!["hwp", "hwpx", "pdf", "doc", "docx"].includes(extension)) return setError("HWP, HWPX, PDF, DOC, DOCX 파일만 첨부할 수 있습니다.");
    setError("");
    setFile(nextFile);
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
    setInputType(nextType);
  };

  const submit = async () => {
    const normalizedQuestions = questions.map((item) => ({ question: item.question.trim(), characterLimit: Number(item.characterLimit) || null }));
    if (!hasDiagnosis || !selectedDiagnosisId) return setError("강점·성향 진단을 먼저 완료해 주세요.");
    if (normalizedQuestions.some((item) => !item.question || !item.characterLimit)) return setError("자소서 문항과 글자 수 제한을 입력해 주세요.");
    if (normalizedQuestions.some((item) => item.characterLimit! < MIN_CHARACTER_LIMIT || item.characterLimit! > MAX_CHARACTER_LIMIT)) return setError("글자 수 제한은 100자 이상 2000자 이하로 입력해 주세요.");
    if (inputType === "text" && !text.trim()) return setError("자소서를 입력해 주세요.");
    if (inputType === "file" && !file) return setError("자소서 파일을 첨부해 주세요.");
    if (!termsConfirmed) return setError("자소서 약관동의를 완료해 주세요.");
    if (!window.confirm("진단권 한장이 소모됩니다. 진행하시겠습니까?")) return;
    setError("");
    setCoaching(true);
    try {
      const result = await coachResume({
        inputType,
        inputText: inputType === "file" ? file?.name || "" : text,
        file,
        jobPostingId: connectedJob?.id,
        jobDuty: connectedJob?.duty,
        questions: normalizedQuestions,
      });
      if (typeof result.creditBalance === "number") {
        window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
          detail: { balance: result.creditBalance },
        }));
      }
      router.push(`/ai-tools/coaching/result/${result.resultId}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "코칭에 실패했습니다.";
      if (message.includes("진단권이 부족합니다")) {
        window.alert(message);
      }
      setError(message);
      setCoaching(false);
    }
  };

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTION_COUNT) {
      window.alert("자소서 문항은 최대 5개까지 추가할 수 있습니다.");
      return;
    }
    setQuestions((items) => [...items, makeQuestionRow()]);
  };

  if (loading) return null;
  if (coaching) return <CoachingLoadingScreen />;

  const selectedDiagnosis = diagnoses.find((item) => item.resultId === selectedDiagnosisId);
  const normalizedQuestions = questions.map((item) => ({ question: item.question.trim(), characterLimit: Number(item.characterLimit) || 0 }));
  const questionsReady = normalizedQuestions.length > 0 && normalizedQuestions.every((item) => item.question && item.characterLimit >= MIN_CHARACTER_LIMIT && item.characterLimit <= MAX_CHARACTER_LIMIT);
  const coverLetterReady = inputType === "text" ? Boolean(text.trim()) : Boolean(file);
  const formReady = Boolean(selectedDiagnosisId) && questionsReady && coverLetterReady && termsConfirmed;

  return <div className={styles.page}>
    <AppHeader />
    <main className={`${styles.frame} ${styles.newCoachingFrame}`}>
      <h1>Ai NCS 자소서 코칭</h1>
      <section className={styles.intro}><strong>자소서를 Ai가 코칭해드려요</strong><p>총평 · 문항별 피드백 · 개선 예시까지 한 번에 확인하세요.</p></section>
      {connectedJob ? <ConnectedJobCard job={connectedJob} onRemove={() => setConnectedJob(null)} /> : <button className={styles.jobConnect} type="button" onClick={openJobPicker}>+ 지원 공고 연결하기 (선택)</button>}
      <StatusCard title="강점·성향 진단 결과" ready={hasDiagnosis} empty="현재 강·약점 결과가 없습니다." action="진단 시작하기 →" href="/ai-tools/diagnosis" onChange={() => setPicker("diagnosis")} selected={selectedDiagnosis?.typeName} date={formatDate(selectedDiagnosis?.completedAt)} />

      <section className={styles.questionSection}>
        <div className={styles.sectionHeading}><h2>자소서 문항</h2><button type="button" onClick={addQuestion} disabled={questions.length >= MAX_QUESTION_COUNT}>+ 추가</button></div>
        {questions.map((item, index) => <div className={styles.questionRow} key={item.id}>
          <textarea aria-label={`자소서 문항 ${index + 1}`} value={item.question} onChange={(event) => updateQuestion(setQuestions, item.id, "question", event.target.value)} placeholder="자소서 문항을 입력하세요." />
          <div className={styles.questionLimitRow}>
            <label htmlFor={`question-limit-${item.id}`}>글자 수 제한</label>
            <input id={`question-limit-${item.id}`} value={item.characterLimit} onChange={(event) => updateQuestion(setQuestions, item.id, "characterLimit", normalizeCharacterLimit(event.target.value))} inputMode="numeric" placeholder="최대 2000자" />
            {index > 0 ? <button className={styles.questionDelete} type="button" onClick={() => setQuestions((items) => items.filter((entry) => entry.id !== item.id))}>삭제</button> : null}
          </div>
        </div>)}
      </section>

      <section className={styles.writeSection}><h2>자소서 작성</h2><div className={styles.tabs}><button className={inputType === "text" ? styles.tabActive : ""} type="button" onClick={() => changeInputType("text")}>직접 입력하기</button><button className={inputType === "file" ? styles.tabActive : ""} type="button" onClick={() => changeInputType("file")}>파일 첨부</button></div>{inputType === "text" ? <><textarea value={text} maxLength={10000} onChange={(event) => setText(event.target.value)} placeholder="작성한 자기소개서를 붙여넣어 주세요." /><span className={styles.counter}>{text.length.toLocaleString()}자 / 10,000자</span></> : <button type="button" className={`${styles.fileDrop} ${isDragActive ? styles.fileDropActive : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragActive(true); }} onDragLeave={() => setIsDragActive(false)} onDrop={(event) => { event.preventDefault(); setIsDragActive(false); handleFile(event.dataTransfer.files?.[0] || null); }}><input ref={fileInputRef} type="file" accept=".hwp,.hwpx,.pdf,.doc,.docx" onChange={(event) => handleFile(event.target.files?.[0] || null)} />{file ? <strong>{file.name}</strong> : <><span className={styles.fileSheetIcon} aria-hidden="true" /><strong>파일을 선택하거나 여기에 끌어다 놓으세요</strong><span>HWP · HWPX · PDF · DOC · DOCX (최대 10MB)</span></>}</button>}</section>
      {inputType === "file" && file ? <button type="button" className={styles.fileRemoveButton} onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>첨부 파일 제거 ×</button> : null}
      <button type="button" className={styles.termsCheck} aria-pressed={termsConfirmed} onClick={() => setTermsOpen(true)}><span>{termsConfirmed ? "✓" : ""}</span>자소서 약관동의를 해주세요.</button>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.primaryButton} type="button" onClick={submit} disabled={coaching || loading || !formReady}>Ai NCS 자소서 코칭 받기</button>
    </main>
    <AppFooter active="ai" />
    {termsOpen ? <TermsSheet onConfirm={() => { setTermsConfirmed(true); setTermsOpen(false); }} onClose={() => setTermsOpen(false)} /> : null}
    {jobPickerOpen ? <JobPicker query={query} setQuery={setQuery} jobs={jobs} searching={searching} onSearch={searchJobs} onPick={(item) => { setJobPickerOpen(false); setDutySheetJob(item); }} onClose={() => setJobPickerOpen(false)} /> : null}
    {dutySheetJob ? <JobDutySheet job={dutySheetJob} onBack={() => { setDutySheetJob(null); setJobPickerOpen(true); }} onClose={() => setDutySheetJob(null)} onConfirm={(duty) => { setConnectedJob({ ...dutySheetJob, duty }); setDutySheetJob(null); }} /> : null}
    {picker === "diagnosis" ? <DiagnosisPicker items={diagnoses} selectedId={selectedDiagnosisId} onPick={async (item) => { await selectDiagnosisResult(item.resultId); setSelectedDiagnosisId(item.resultId); setHasDiagnosis(true); setPicker(null); }} onClose={() => setPicker(null)} /> : null}
  </div>;
}

function CoachingLoadingScreen() {
  return <div className={`${styles.page} ${styles.coachingLoadingPage}`}><main className={styles.coachingLoadingFrame} aria-live="polite" aria-busy="true"><Image src="/coaching/coaching-loading-owl.png" alt="" width={114} height={140} priority className={styles.coachingLoadingImage} /><h1>데이터 분석중입니다...</h1><p>Ai 자소서 코칭을 진행중이에요.</p><div className={styles.coachingLoadingTrack} aria-hidden="true"><span /></div></main></div>;
}

function ConnectedJobCard({ job, onRemove }: { job: ConnectedJob; onRemove: () => void }) {
  return <section className={styles.connectedJobCard}><button type="button" onClick={onRemove} aria-label="지원 공고 연결 해제">×</button><span>지원 공고</span><strong>{job.title}</strong><em>직무</em><p>{job.duty}</p><small>✓ 이 공고의 직무 적합성까지 함께 분석해요</small></section>;
}

function StatusCard({ title, ready, empty, action, href, onChange, selected, date }: { title: string; ready: boolean; empty: string; action: string; href: string; onChange: () => void; selected?: string; date?: string }) {
  return <section className={styles.statusSection}><div className={styles.sectionHeading}><h2>{title}</h2>{ready ? <button type="button" onClick={onChange}>변경</button> : null}</div>{ready ? <div className={styles.readyCard}><strong>{selected || "등록된 정보가 있어요."}</strong>{date ? <p>{date}</p> : null}</div> : <div className={styles.emptyCard}><p>{empty}</p><Link href={href}>{action}</Link></div>}</section>;
}

function JobPicker({ query, setQuery, jobs, searching, onSearch, onPick, onClose }: { query: string; setQuery: (value: string) => void; jobs: CoachingJob[]; searching: boolean; onSearch: () => void; onPick: (job: CoachingJob) => void; onClose: () => void }) {
  return <div className={styles.overlay}><section className={`${styles.modal} ${styles.coachingSheet}`}><div className={styles.sheetHandle} /><header><h2>연결할 공고 선택</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.search}><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && onSearch()} placeholder="기업명이나, 공고명을 입력하세요." /><button type="button" onClick={onSearch}>검색</button></div><div className={styles.jobResults}>{searching ? <p>공고를 찾는 중...</p> : jobs.length ? jobs.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)}><span>{item.institutionName}</span><strong>{item.title}</strong><small>~ {item.applicationEndAt ? new Date(item.applicationEndAt).toLocaleDateString("ko-KR") : "상시채용"}</small></button>) : <p>검색 결과가 없습니다.</p>}</div></section></div>;
}

function JobDutySheet({ job, onBack, onClose, onConfirm }: { job: CoachingJob; onBack: () => void; onClose: () => void; onConfirm: (duty: string) => void }) {
  const [duty, setDuty] = useState("");
  return <div className={styles.overlay}><section className={`${styles.modal} ${styles.coachingSheet}`}><div className={styles.sheetHandle} /><header><button type="button" onClick={onBack} aria-label="이전">‹</button><h2>직무</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.jobDutySelected}><span>{job.institutionName}</span><strong>{job.title}</strong></div><label className={styles.jobDutyLabel}>직무</label><input className={styles.jobDutyInput} value={duty} onChange={(event) => setDuty(event.target.value)} placeholder="직무를 입력하세요." /><button className={styles.primaryButton} type="button" disabled={!duty.trim()} onClick={() => onConfirm(duty.trim())}>공고 연결하기</button></section></div>;
}

function TermsSheet({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const [readAll, setReadAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element && element.scrollHeight <= element.clientHeight + 4) setReadAll(true);
  }, []);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 4) setReadAll(true);
  };

  return <div className={styles.overlay}><section className={`${styles.modal} ${styles.termsSheet}`}><div className={styles.sheetHandle} /><header><h2>약관동의</h2><button type="button" onClick={onClose} aria-label="약관 닫기">×</button></header><div ref={scrollRef} className={styles.termsScroll} onScroll={handleScroll}><section className={styles.termsBlock}><h3>NCS 자소서 첨삭 기준</h3><p className={styles.termsIntro}>NCS 기반 채용은 학벌이나 인상이 아니라 &quot;이 사람이 실제로 무엇을 해봤고, 그래서 무엇이 달라졌는가&quot;를 근거로 사람을 뽑는 방식입니다. 그래서 서류 이후의 경험면접은 자소서에 적힌 행동을 그대로 파고들어 확인합니다.<br /><br />평가자가 채점 근거로 삼을 수 있는 건 감상이 아니라 상황·역할·행동·결과가 드러난 문장입니다. &quot;많이 배웠습니다&quot;는 확인할 수가 없고, &quot;무엇을 어떻게 해서 무엇이 몇 건 줄었다&quot;는 확인할 수 있습니다. 아래 네 가지 틀은 그 네 가지 정보가 빠지지 않게 잡아주는 점검용 격자입니다.</p><MethodText method="PREP" title="주장 → 이유 → 사례 → 재강조">지원동기·가치관·포부처럼 생각과 판단을 묻는 문항. 조직이해와 직업윤리 항목에서 판단 근거를 봅니다.</MethodText><MethodText method="CAR" title="배경 → 행동 → 결과">프로젝트·직무 경험처럼 성과를 짧게 보여야 하는 문항. 분량이 빠듯할 때 상황 설명을 줄이는 데 유리합니다.</MethodText><MethodText method="PAP" title="주장 → 이유 → 사례 → 재강조">갈등·위기·문제해결 문항. 문제해결능력과 대인관계능력을 볼 때 평가자는 문제를 어떻게 정의했는지부터 봅니다.</MethodText><MethodText method="STAR" title="상황 → 과제 → 행동 → 결과">위 셋에 딱 맞지 않는 일반 경험형 문항의 기본값. 면접관 교육에서 가장 널리 쓰이는 구조입니다.</MethodText><div className={styles.termsNote}><p>이 네 가지는 기관이 공개한 채점표가 아닙니다.<br />실제 평가표는 기관마다 다르고 외부에 공개되지 않습니다.<br />다만 어느 기관이든 행동과 결과가 비어 있는 글에 점수를 줄 근거가 없다는 점은 같습니다.</p><p>그래서 이 틀을 점수 기준이 아니라 빠진 정보를 찾는 도구로만 씁니다. 모든 지적에 원문을 그대로 인용해 두었으니, 동의가 안 되는 지적은 넘기셔도 됩니다.</p></div></section><section className={styles.termsReference}><h3>참고사항</h3><TermsReference title="이 결과는 합격 여부를 예측하지 않습니다">기관의 실제 평가표는 공개되지 않아 점수나 확률을 낼 근거가 없습니다. 여기서 한 일은 문항이 요구한 것을 빠뜨렸는지, 글자수가 맞는지, 확인할 수 없는 표현이 있는지를 짚어드린 것까지입니다.</TermsReference><TermsReference title="문항과 글자수는 입력하신 값 기준입니다">지원 사이트에서 문항이 수정되거나 공백 제외로 세는 경우가 있으니, 제출 직전에 실제 입력창에서 한 번 더 확인해 주세요.</TermsReference><TermsReference title="사실 확인은 본인 몫입니다">냉방 지원 사업, 52건에서 20건, 최종 상위 평가 세 가지는 저희가 진위를 확인할 수 없습니다. 공고문에 허위 기재 시 합격 취소 조항이 있으니 근거가 없다면 문구를 낮추시는 편이 안전합니다.</TermsReference><TermsReference title="수정 예시는 예시일 뿐입니다">그대로 붙여넣으면 다른 지원자의 글과 비슷해질 수 있습니다. 뜻만 가져가서 본인 표현으로 다시 쓰시길 권합니다.</TermsReference><TermsReference title="동의가 안 되는 지적은 넘기세요.">모든 지적에 원문을 그대로 인용해 둔 이유가 그것입니다. 판단이 갈리는 부분은 &apos;선택&apos;으로 표시했고, 최종 결정은 지원자 본인이 하는 게 맞습니다.</TermsReference><TermsReference title="작성한 글은 개인정보입니다">분석에 사용한 원문의 보관 기간과 학습 활용 여부는 개인정보 처리방침에서 확인하실 수 있습니다.</TermsReference></section></div><button className={styles.primaryButton} type="button" disabled={!readAll} onClick={onConfirm}>약관 확인하기</button></section></div>;
}

function MethodText({ method, title, children }: { method: string; title: string; children: string }) {
  return <div className={styles.termsMethod}><b>{method}</b><span><strong>{title}</strong><p>{children}</p></span></div>;
}

function TermsReference({ title, children }: { title: string; children: string }) {
  return <article className={styles.termsReferenceItem}><strong>{title}</strong><p>{children}</p></article>;
}

function DiagnosisPicker({ items, selectedId, onPick, onClose }: { items: DiagnosisResultHistoryItemDto[]; selectedId: string | null; onPick: (item: DiagnosisResultHistoryItemDto) => void; onClose: () => void }) {
  return <div className={styles.overlay}><section className={`${styles.modal} ${styles.coachingSheet}`}><div className={styles.sheetHandle} /><header><h2>강점·성향 진단 결과</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.pickerList}>{items.map((item) => <button type="button" key={item.resultId} className={styles.pickerCard} onClick={() => onPick(item)}><span><strong>{item.typeName}</strong><small>{formatDate(item.completedAt)}</small></span>{item.resultId === selectedId ? <b className={styles.selectedLabel}>선택됨 ✓</b> : <em>선택하기</em>}</button>)}</div></section></div>;
}

function makeQuestionRow(): QuestionRow {
  return { id: crypto.randomUUID(), question: "", characterLimit: "" };
}

function updateQuestion(setter: (updater: (items: QuestionRow[]) => QuestionRow[]) => void, id: string, key: "question" | "characterLimit", value: string) {
  setter((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));
}

function normalizeCharacterLimit(value: string) {
  const numericValue = value.replace(/\D/g, "");
  if (!numericValue) return "";
  return String(Math.min(Number(numericValue), MAX_CHARACTER_LIMIT));
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }) : "";
}
