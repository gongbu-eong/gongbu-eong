"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { trackProductEvent } from "@/features/analytics/analytics.api";
import { CoachingBannerSlot } from "@/features/banners/components/CoachingBannerSlot";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getJobPosting, getJobPostings } from "@/features/home/home.api";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { focusMobileInput, watchMobileKeyboardInset } from "@/shared/mobile-focus";
import { coachResume } from "../coaching.api";
import type { CoachingJob } from "../coaching.dto";
import { CoachingAlertDialog } from "./CoachingAlertDialog";
import styles from "./CoachingPage.module.css";

type ConnectedJob = CoachingJob & { duty: string };
const ALLOWED_COACHING_FILE_EXTENSIONS = ["hwp", "hwpx", "pdf", "docx"] as const;
const COACHING_FILE_ACCEPT =
  ".hwp,.hwpx,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/x-hwp,application/haansofthwp,application/vnd.hancom.hwp,application/vnd.hancom.hwpx";
const COACHING_FILE_GUIDE = "HWP · HWPX · PDF · DOCX (최대 10MB)";

export function CoachingPage({
  initialJobPostingId = "",
}: {
  initialJobPostingId?: string;
} = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileDropRef = useRef<HTMLButtonElement | null>(null);
  const coverLetterTextRef = useRef<HTMLTextAreaElement | null>(null);
  const termsButtonRef = useRef<HTMLButtonElement | null>(null);
  const jobConnectRef = useRef<HTMLButtonElement | null>(null);
  const alertFocusRef = useRef<HTMLElement | null>(null);
  const jobSearchSeqRef = useRef(0);
  const presetJobHandledRef = useRef("");
  const [coaching, setCoaching] = useState(false);
  const [error, setError] = useState("");
  const [inputType, setInputType] = useState<"text" | "file">("file");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [dutySheetJob, setDutySheetJob] = useState<CoachingJob | null>(null);
  const [dutySheetFromBanner, setDutySheetFromBanner] = useState(false);
  const [connectedJob, setConnectedJob] = useState<ConnectedJob | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [jobs, setJobs] = useState<CoachingJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearchedJobs, setHasSearchedJobs] = useState(false);
  // const [confirmOpen, setConfirmOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  useBodyScrollLock(Boolean(termsOpen || jobPickerOpen || dutySheetJob || alertMessage));
  // useBodyScrollLock(Boolean(termsOpen || jobPickerOpen || dutySheetJob || confirmOpen || alertMessage));

  useEffect(() => {
    if (!termsOpen && !jobPickerOpen && !dutySheetJob && !alertMessage) return;
    return watchMobileKeyboardInset();
  }, [termsOpen, jobPickerOpen, dutySheetJob, alertMessage]);
  // useEffect(() => {
  //   if (!termsOpen && !jobPickerOpen && !dutySheetJob && !confirmOpen && !alertMessage) return;
  //   return watchMobileKeyboardInset();
  // }, [termsOpen, jobPickerOpen, dutySheetJob, confirmOpen, alertMessage]);

  const searchJobs = async (nextQuery = query) => {
    const searchId = ++jobSearchSeqRef.current;
    const searchTerm = nextQuery.trim();
    if (!searchTerm) {
      setJobs([]);
      setSubmittedQuery("");
      setHasSearchedJobs(false);
      setSearching(false);
      return;
    }
    setSubmittedQuery(searchTerm);
    setHasSearchedJobs(true);
    setSearching(true);
    try {
      const result = await getJobPostings({ query: searchTerm, sort: "latest", includeClosedMonths: 6 });
      if (searchId !== jobSearchSeqRef.current) return;
      const activeJobs = result.items.map((item) => ({ id: item.id, institutionName: item.institutionName, title: item.title, applicationEndAt: item.applicationEndAt }));
      setJobs(activeJobs);
    } finally {
      if (searchId === jobSearchSeqRef.current) setSearching(false);
    }
  };

  const openJobPicker = () => {
    setQuery("");
    setSubmittedQuery("");
    setJobs([]);
    setHasSearchedJobs(false);
    setJobPickerOpen(true);
  };

  const closeJobPicker = () => {
    jobSearchSeqRef.current += 1;
    setSearching(false);
    setQuery("");
    setSubmittedQuery("");
    setJobs([]);
    setHasSearchedJobs(false);
    setJobPickerOpen(false);
  };

  const handleFile = (nextFile: File | null) => {
    if (!nextFile) return;
    if (nextFile.size > 10 * 1024 * 1024) return setError("10MB 이하 파일만 업로드할 수 있습니다.");
    const extension = nextFile.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_COACHING_FILE_EXTENSIONS.includes(extension as typeof ALLOWED_COACHING_FILE_EXTENSIONS[number])) return setError("HWP, HWPX, PDF, DOCX 파일만 첨부할 수 있습니다.");
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

  const showAlert = (message: string, target?: HTMLElement | null) => {
    alertFocusRef.current = target || null;
    setError("");
    focusField(target);
    setAlertMessage(message);
  };

  useEffect(() => {
    const jobPostingId = initialJobPostingId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobPostingId)) return;
    if (presetJobHandledRef.current === jobPostingId) return;
    presetJobHandledRef.current = jobPostingId;
    let active = true;

    void getJobPosting(jobPostingId)
      .then((job) => {
        if (!active) return;
        setJobPickerOpen(false);
        setDutySheetFromBanner(true);
        setDutySheetJob({
          id: job.id,
          institutionName: job.institutionName,
          title: job.title,
          applicationEndAt: job.applicationEndAt,
        });
      })
      .catch((caught) => {
        if (!active) return;
        setAlertMessage(caught instanceof Error ? caught.message : "연결할 공고를 불러오지 못했습니다.");
      });

    return () => {
      active = false;
    };
  }, [initialJobPostingId]);

  const validateBeforeSubmit = () => {
    if (!connectedJob || connectedJob.isManual || !connectedJob.duty.trim()) {
      return { message: "지원 공고와 지원 직무를 연결해 주세요.", target: jobConnectRef.current };
    }
    if (inputType === "text" && !text.trim()) {
      return { message: "자소서를 입력해 주세요.", target: coverLetterTextRef.current };
    }
    if (inputType === "file" && !file) {
      return { message: "자소서 파일을 첨부해 주세요.", target: fileDropRef.current };
    }
    if (!termsConfirmed) {
      return { message: "자소서 약관동의를 완료해 주세요.", target: termsButtonRef.current };
    }
    return { message: "", target: null };
  };

  const submit = async () => {
    const validation = validateBeforeSubmit();
    if (validation.message) {
      showAlert(validation.message, validation.target);
      return;
    }
    // 진단권 소모 확인 alert 비활성화.
    // setConfirmOpen(true);
    void runCoaching();
  };

  const runCoaching = async () => {
    if (!connectedJob) return;
    // setConfirmOpen(false);
    setError("");
    setCoaching(true);
    try {
      const result = await coachResume({
        inputType,
        inputText: inputType === "file" ? file?.name || "" : text,
        file,
        anonymousId: getAnonymousId(),
        jobPostingId: connectedJob.id,
        jobDuty: connectedJob.duty,
      });
      // 진단권 소모 및 잔액 동기화 로직 비활성화.
      // if (typeof result.creditBalance === "number") {
      //   window.dispatchEvent(new CustomEvent("gongbu-ticket-balance-changed", {
      //     detail: { balance: result.creditBalance },
      //   }));
      // }
      router.push(`/ai-tools/coaching/result/${result.resultId}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "코칭에 실패했습니다.";
      showAlert(message, inputType === "text" ? coverLetterTextRef.current : fileDropRef.current);
      setError(message);
      setCoaching(false);
    }
  };

  if (coaching) return <CoachingLoadingScreen />;

  const canRequestCoaching = termsConfirmed && !coaching;

  return <div className={styles.page}>
    <AppHeader />
    <main className={`${styles.frame} ${styles.newCoachingFrame}`}>
      <h1>AI NCS 자소서 코칭</h1>
      <section className={styles.intro}><strong>자소서를 AI가 코칭해드려요</strong><p>총평 · 문항별 피드백 · 개선 예시까지 한 번에 확인하세요.</p></section>
      <CoachingBannerSlot
        placement="resume_coaching"
        fallback={(
          <Link
            href="/ai-tools/coaching/guide"
            className={styles.guideBanner}
            onClick={() => {
              void trackProductEvent({
                eventType: "resume_coaching_guide_click",
                properties: { placement: "resume_coaching_job_connect" },
              });
            }}
          >
            <span>
              <strong>혹시 AI NCS 자소서 코칭이 처음이라면?</strong>
              <small>사용 방법과 준비할 내용을 한눈에 확인해 보세요.</small>
            </span>
            <b aria-hidden="true" />
          </Link>
        )}
      />
      <section className={styles.companySection}>
        <h2>자소서 기업 정보</h2>
        {connectedJob ? <ConnectedJobCard job={connectedJob} onRemove={() => setConnectedJob(null)} /> : <button ref={jobConnectRef} className={styles.jobConnect} type="button" onClick={openJobPicker}>+ 지원 공고 연결하기</button>}
      </section>

      <section className={styles.writeSection}>
        <h2>자소서 작성</h2>
        <div className={`${styles.writePanel} ${inputType === "file" ? styles.writePanelFile : ""}`}>
          <div className={styles.tabs}>
            <button className={inputType === "file" ? styles.tabActive : ""} type="button" onClick={() => changeInputType("file")}>파일 첨부</button>
            <button className={inputType === "text" ? styles.tabActive : ""} type="button" onClick={() => changeInputType("text")}>직접 입력하기</button>
          </div>
          {inputType === "text" ? (
            <>
              <textarea
                ref={coverLetterTextRef}
                value={text}
                maxLength={10000}
                onFocus={(event) => focusField(event.currentTarget)}
                onChange={(event) => setText(event.target.value)}
                placeholder="작성한 자기소개서를 항목 구분 없이 통째로 붙여넣어 주세요. (예: 지원동기, 성장과정, 입사 후 포부 등이 모두 포함된 전체 글)"
              />
              <span className={styles.counter}>{formatNumber(text.length)}자</span>
            </>
          ) : (
            <div className={styles.fileUploadArea}>
              <p className={styles.fileUploadLabel}>파일로 자소서 업로드</p>
              <button
                ref={fileDropRef}
                type="button"
                className={`${styles.fileDrop} ${isDragActive ? styles.fileDropActive : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onFocus={(event) => focusField(event.currentTarget)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                  handleFile(event.dataTransfer.files?.[0] || null);
                }}
              >
                <input
                ref={fileInputRef}
                type="file"
                accept={COACHING_FILE_ACCEPT}
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
                {file ? (
                  <strong>{file.name}</strong>
                ) : (
                  <>
                    <span className={styles.fileDropIcon} aria-hidden="true">
                      <Image
                        src="/coaching/file-upload-document.png"
                        alt=""
                        width={32}
                        height={32}
                      />
                    </span>
                    <strong>파일을 선택하거나 여기에 끌어다 놓으세요</strong>
                    <small>{COACHING_FILE_GUIDE}</small>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        {inputType === "file" && file ? <button type="button" className={styles.fileRemoveButton} onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>첨부 파일 제거 ×</button> : null}
      </section>
      <div className={styles.termsConsentRow}>
        <button ref={termsButtonRef} type="button" className={styles.termsCheck} aria-pressed={termsConfirmed} onClick={() => setTermsConfirmed((value) => !value)}><span>{termsConfirmed ? "선택됨" : ""}</span>AI NCS 자소서 약관동의를 해주세요.</button>
        <button type="button" className={styles.termsOpenButton} onClick={() => setTermsOpen(true)}>보기 →</button>
      </div>
      <p className={styles.coachingPrivacyNotice}>첨부 및 입력한 자소서는 코칭 제공 목적으로만 사용됩니다.</p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={`${styles.primaryButton} ${styles.coachingSubmitButton}`} type="button" onClick={submit} disabled={!canRequestCoaching}>{/* <Image src="/layout/header-ticket.png" alt="" width={23} height={12} className={styles.coachingSubmitIcon} /> */}AI NCS 자소서 코칭 받기</button>
    </main>
    <AppFooter active="ai" />
    {termsOpen ? <TermsSheet onConfirm={() => { setTermsConfirmed(true); setTermsOpen(false); }} onClose={() => setTermsOpen(false)} /> : null}
    {jobPickerOpen ? <JobPicker query={query} submittedQuery={submittedQuery} setQuery={setQuery} jobs={jobs} searching={searching} hasSearched={hasSearchedJobs} onSearch={() => searchJobs()} onPick={(item) => { setJobPickerOpen(false); setDutySheetFromBanner(false); setDutySheetJob(item); }} onClose={closeJobPicker} /> : null}
    {dutySheetJob ? <JobDutySheet job={dutySheetJob} onBack={dutySheetFromBanner ? undefined : () => { setDutySheetJob(null); setJobPickerOpen(true); }} onClose={() => { setDutySheetJob(null); setDutySheetFromBanner(false); closeJobPicker(); }} onConfirm={(duty) => { setConnectedJob({ ...dutySheetJob, duty }); setDutySheetJob(null); setDutySheetFromBanner(false); closeJobPicker(); }} /> : null}
    {/* {confirmOpen ? <CoachingConfirmDialog onCancel={() => setConfirmOpen(false)} onConfirm={runCoaching} /> : null} */}
    {alertMessage ? <CoachingAlertDialog message={alertMessage} onClose={() => { setAlertMessage(""); window.setTimeout(() => focusField(alertFocusRef.current), 0); }} /> : null}
  </div>;
}

function CoachingLoadingScreen() {
  return <div className={`${styles.page} ${styles.coachingLoadingPage}`}><main className={styles.coachingLoadingFrame} aria-live="polite" aria-busy="true"><Image src="/coaching/coaching-loading-owl.png" alt="" width={114} height={140} priority className={styles.coachingLoadingImage} /><h1>데이터 분석중입니다...</h1><p>AI NCS 자소서 코칭을 진행중이에요.</p><div className={styles.coachingLoadingTrack} aria-hidden="true"><span /></div></main></div>;
}

function ConnectedJobCard({ job, onRemove }: { job: ConnectedJob; onRemove: () => void }) {
  return <><section className={styles.connectedJobCard}><button type="button" onClick={onRemove} aria-label="지원 공고 연결 해제"><Image src="/coaching/close-rounded.svg" alt="" width={24} height={24} /></button><span>지원 공고</span><strong>{formatConnectedJobTitle(job)}</strong><em>직무</em><p>{job.duty}</p></section><small className={styles.jobFitNotice}>이 공고의 직무 적합성까지 함께 분석해요</small></>;
}

function JobPicker({
  query,
  submittedQuery,
  setQuery,
  jobs,
  searching,
  hasSearched,
  onSearch,
  onPick,
  onClose,
}: {
  query: string;
  submittedQuery: string;
  setQuery: (value: string) => void;
  jobs: CoachingJob[];
  searching: boolean;
  hasSearched: boolean;
  onSearch: () => void;
  onPick: (job: CoachingJob) => void;
  onClose: () => void;
}) {
  const searchLabel = submittedQuery.trim() || "입력한 검색어";

  return <div className={styles.overlay}><section data-keyboard-sheet="true" className={`${styles.modal} ${styles.coachingSheet} ${styles.jobPickerSheet}`}><div className={styles.sheetHandle} /><header><h2>연결할 공고 선택</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.search}><input value={query} onFocus={(event) => focusSheetField(event.currentTarget)} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSearch(); }} placeholder="기업명이나, 공고명을 입력하세요." /><button type="button" onClick={onSearch}>검색</button></div>{hasSearched && !searching ? <p className={styles.jobResultTitle}>검색결과</p> : null}<div className={styles.jobResults}>{searching ? <p>공고를 찾는 중...</p> : jobs.length ? jobs.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)}><span>{item.institutionName}</span><strong>{item.title}</strong><small>~ {item.applicationEndAt ? new Date(item.applicationEndAt).toLocaleDateString("ko-KR") : "상시채용"}</small></button>) : hasSearched ? <div className={styles.noJobResult}><strong><span>{`'${searchLabel}'`}</span>에 대한 검색결과가 없습니다.</strong><ul><li>단어의 철자가 정확한지 확인해 주세요. 검색어를 줄이거나, 더 일반적인 검색어로 검색해 보세요.</li><li>설정한 검색 조건이 있다면 일부 해제 하거나 변경해 보세요.</li></ul></div> : <p className={styles.searchGuide}>검색해주세요.</p>}</div></section></div>;
}

function JobDutySheet({ job, onBack, onClose, onConfirm }: { job: CoachingJob; onBack?: () => void; onClose: () => void; onConfirm: (duty: string) => void }) {
  const [duty, setDuty] = useState("");
  return <div className={styles.overlay}><section data-keyboard-sheet="true" className={`${styles.modal} ${styles.coachingSheet} ${styles.jobDutySheet}`}><div className={styles.sheetHandle} /><header>{onBack ? <button type="button" onClick={onBack} aria-label="이전">‹</button> : <span className={styles.jobDutyHeaderSpacer} aria-hidden="true" />}<h2>직무</h2><button type="button" onClick={onClose}>×</button></header><div className={styles.jobDutySelected}><span>{job.isManual ? "직접 입력한 공고" : job.institutionName}</span><strong>{formatConnectedJobTitle(job)}</strong></div><label className={styles.jobDutyLabel}>지원 직무</label><input className={styles.jobDutyInput} value={duty} onFocus={(event) => focusSheetField(event.currentTarget)} onChange={(event) => setDuty(event.target.value)} placeholder="예 : 사무행정, 전기, 토목" /><button className={styles.primaryButton} type="button" disabled={!duty.trim()} onClick={() => onConfirm(duty.trim())}>공고 연결하기</button></section></div>;
}

/*
function CoachingConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <div className={styles.dialogOverlay} role="dialog" aria-modal="true" aria-labelledby="coaching-confirm-title"><section className={styles.figmaDialog}><div className={styles.dialogVisual}><Image src="/coaching/coaching-confirm-bg.svg" alt="" width={207} height={125} className={styles.dialogBg} /><Image src="/coaching/coaching-confirm-owl.png" alt="" width={163} height={168} className={styles.confirmOwl} priority /></div><h2 id="coaching-confirm-title">진단권을 1장을 소모하시겠습니까?</h2><div className={styles.confirmActions}><button type="button" onClick={onCancel}>취소</button><button type="button" onClick={onConfirm}>확인</button></div></section></div>;
}
*/

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

  return <div className={styles.overlay}><section className={`${styles.modal} ${styles.termsSheet}`}><div className={styles.sheetHandle} /><header><h2>약관동의</h2><button type="button" onClick={onClose} aria-label="약관 닫기">×</button></header><div ref={scrollRef} className={styles.termsScroll} onScroll={handleScroll}><section className={styles.termsBlock}><h3>NCS 자소서 첨삭 기준</h3><p className={styles.termsIntro}>NCS 기반 채용은 학벌이나 인상이 아니라 &quot;이 사람이 실제로 무엇을 해봤고, 그래서 무엇이 달라졌는가&quot;를 근거로 사람을 뽑는 방식입니다. 그래서 서류 이후의 경험면접은 자소서에 적힌 행동을 그대로 파고들어 확인합니다.<br /><br />평가자가 채점 근거로 삼을 수 있는 건 감상이 아니라 상황·역할·행동·결과가 드러난 문장입니다. &quot;많이 배웠습니다&quot;는 확인할 수가 없고, &quot;무엇을 어떻게 해서 무엇이 몇 건 줄었다&quot;는 확인할 수 있습니다. 아래 네 가지 틀은 그 네 가지 정보가 빠지지 않게 잡아주는 점검용 격자입니다.</p><MethodText method="PREP" title="주장 → 이유 → 사례 → 재강조">지원동기·가치관·포부처럼 생각과 판단을 묻는 문항. 조직이해와 직업윤리 항목에서 판단 근거를 봅니다.</MethodText><MethodText method="CAR" title="배경 → 행동 → 결과">프로젝트·직무 경험처럼 성과를 짧게 보여야 하는 문항. 분량이 빠듯할 때 상황 설명을 줄이는 데 유리합니다.</MethodText><MethodText method="PAP" title="주장 → 이유 → 사례 → 재강조">갈등·위기·문제해결 문항. 문제해결능력과 대인관계능력을 볼 때 평가자는 문제를 어떻게 정의했는지부터 봅니다.</MethodText><MethodText method="STAR" title="상황 → 과제 → 행동 → 결과">위 셋에 딱 맞지 않는 일반 경험형 문항의 기본값. 면접관 교육에서 가장 널리 쓰이는 구조입니다.</MethodText><div className={styles.termsNote}><p>이 네 가지는 기관이 공개한 채점표가 아닙니다.<br />실제 평가표는 기관마다 다르고 외부에 공개되지 않습니다.<br />다만 어느 기관이든 행동과 결과가 비어 있는 글에 점수를 줄 근거가 없다는 점은 같습니다.</p><p>그래서 이 틀을 점수 기준이 아니라 빠진 정보를 찾는 도구로만 씁니다. 모든 지적에 원문을 그대로 인용해 두었으니, 동의가 안 되는 지적은 넘기셔도 됩니다.</p></div></section><section className={styles.termsReference}><h3>참고사항</h3><TermsReference title="이 결과는 합격 여부를 예측하지 않습니다">기관의 실제 평가표는 공개되지 않아 점수나 확률을 낼 근거가 없습니다. 연결한 공고와 지원 직무에 맞는 경험과 근거가 드러나는지, 확인할 수 없는 표현이 있는지를 짚어드립니다.</TermsReference><TermsReference title="제출 문항과 글자 수 제한은 직접 확인해 주세요">별도 문항과 글자 수 제한은 입력받지 않습니다. 자소서 원문을 기준으로 코칭하므로, 제출 직전에 지원 사이트의 실제 문항과 분량 기준을 확인해 주세요.</TermsReference><TermsReference title="사실 확인은 본인 몫입니다">냉방 지원 사업, 52건에서 20건, 최종 상위 평가 세 가지는 저희가 진위를 확인할 수 없습니다. 공고문에 허위 기재 시 합격 취소 조항이 있으니 근거가 없다면 문구를 낮추시는 편이 안전합니다.</TermsReference><TermsReference title="수정 예시는 예시일 뿐입니다">그대로 붙여넣으면 다른 지원자의 글과 비슷해질 수 있습니다. 뜻만 가져가서 본인 표현으로 다시 쓰시길 권합니다.</TermsReference><TermsReference title="동의가 안 되는 지적은 넘기세요.">모든 지적에 원문을 그대로 인용해 둔 이유가 그것입니다. 판단이 갈리는 부분은 &apos;선택&apos;으로 표시했고, 최종 결정은 지원자 본인이 하는 게 맞습니다.</TermsReference><TermsReference title="작성한 글은 개인정보입니다">분석에 사용한 원문의 보관 기간과 학습 활용 여부는 개인정보 처리방침에서 확인하실 수 있습니다.</TermsReference></section></div><button className={styles.primaryButton} type="button" disabled={!readAll} onClick={onConfirm}>약관 확인하기</button></section></div>;
}

function MethodText({ method, title, children }: { method: string; title: string; children: string }) {
  return <div className={styles.termsMethod}><b>{method}</b><span><strong>{title}</strong><p>{children}</p></span></div>;
}

function TermsReference({ title, children }: { title: string; children: string }) {
  return <article className={styles.termsReferenceItem}><strong>{title}</strong><p>{children}</p></article>;
}

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function focusField(element?: HTMLElement | null) {
  if (!element) return;
  if ("focus" in element) element.focus({ preventScroll: true });
  focusMobileInput(element);
}

function focusSheetField(element?: HTMLElement | null) {
  if (!element) return;
  const sheet = element.closest<HTMLElement>("[data-keyboard-sheet]");
  if (!sheet) {
    focusField(element);
    return;
  }
  window.setTimeout(() => {
    const sheetRect = sheet.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    const topPadding = 72;
    const bottomPadding = 120;
    if (targetRect.top < sheetRect.top + topPadding) {
      sheet.scrollBy({ top: targetRect.top - sheetRect.top - topPadding, behavior: "smooth" });
    } else if (targetRect.bottom > sheetRect.bottom - bottomPadding) {
      sheet.scrollBy({ top: targetRect.bottom - sheetRect.bottom + bottomPadding, behavior: "smooth" });
    }
  }, 80);
}

function formatConnectedJobTitle(job: CoachingJob) {
  return job.isManual ? job.title : `[${job.institutionName}] ${job.title}`;
}
