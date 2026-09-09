"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getJobPostings } from "@/features/home/home.api";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { focusMobileInput, watchMobileKeyboardInset } from "@/shared/mobile-focus";
import {
  answerInterviewQuestion,
  completeInterviewCoaching,
  startInterviewCoaching,
} from "../interview-coaching.api";
import type {
  InterviewCoachingJob,
  InterviewCoachingSession,
  InterviewMessage,
  InterviewQuestion,
} from "../interview-coaching.dto";
import styles from "./InterviewCoachingPage.module.css";

type ConnectedJob = InterviewCoachingJob & { duty: string };

const MAX_ANSWER_LENGTH = 4000;

export function InterviewCoachingPage() {
  const router = useRouter();
  const jobSearchSeqRef = useRef(0);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const alertFocusRef = useRef<HTMLElement | null>(null);
  const [connectedJob, setConnectedJob] = useState<ConnectedJob | null>(null);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [dutySheetJob, setDutySheetJob] = useState<InterviewCoachingJob | null>(null);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<InterviewCoachingJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualJobKeyword, setManualJobKeyword] = useState("");
  const [manualCompanyName, setManualCompanyName] = useState("");
  const [manualPositionName, setManualPositionName] = useState("");
  const [manualDuty, setManualDuty] = useState("");
  const [session, setSession] = useState<InterviewCoachingSession | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"start" | "answer" | "complete" | null>(null);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  useBodyScrollLock(Boolean(jobPickerOpen || dutySheetJob || alertMessage));

  useEffect(() => {
    if (!jobPickerOpen && !dutySheetJob && !alertMessage) return;
    return watchMobileKeyboardInset();
  }, [jobPickerOpen, dutySheetJob, alertMessage]);

  const searchJobs = async (nextQuery = query) => {
    const searchId = ++jobSearchSeqRef.current;
    const searchTerm = nextQuery.trim();
    setSearching(true);
    try {
      const result = await getJobPostings({
        query: searchTerm,
        limit: 20,
        sort: "closing",
        employmentType: "정규직",
      });
      if (searchId !== jobSearchSeqRef.current) return;
      const activeJobs = result.items
        .filter((item) => !item.isClosed)
        .map((item) => ({
          id: item.id,
          institutionName: item.institutionName,
          title: item.title,
          applicationEndAt: item.applicationEndAt,
        }));
      setJobs(activeJobs);
      if (!activeJobs.length) setManualJobKeyword(searchTerm);
    } finally {
      if (searchId === jobSearchSeqRef.current) setSearching(false);
    }
  };

  const openJobPicker = () => {
    setQuery("");
    setJobs([]);
    setManualJobKeyword("");
    setJobPickerOpen(true);
    void searchJobs("");
  };

  const closeJobPicker = () => {
    jobSearchSeqRef.current += 1;
    setSearching(false);
    setQuery("");
    setJobs([]);
    setManualJobKeyword("");
    setJobPickerOpen(false);
  };

  const showAlert = (message: string, target?: HTMLElement | null) => {
    alertFocusRef.current = target || null;
    setError("");
    focusField(target);
    setAlertMessage(message);
  };

  const start = async () => {
    const anonymousId = getAnonymousId();
    const companyName = connectedJob && !connectedJob.isManual
      ? connectedJob.institutionName
      : manualCompanyName;
    const positionName = connectedJob ? connectedJob.title : manualPositionName;
    const dutyText = connectedJob?.duty || manualDuty;

    if (!connectedJob && !positionName.trim() && !dutyText.trim()) {
      showAlert("지원 공고를 연결하거나 직무명을 입력해 주세요.");
      return;
    }

    setBusy("start");
    setError("");
    try {
      const result = await startInterviewCoaching({
        anonymousId,
        jobPostingId: connectedJob?.isManual ? null : connectedJob?.id,
        manualCompanyName: companyName || null,
        manualPositionName: positionName || connectedJob?.title || null,
        jobDuty: dutyText || null,
      });
      setSession(result.session);
      setSelectedQuestionId(result.session.questions[0]?.id || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "면접 코칭을 시작하지 못했습니다.";
      setError(message);
      showAlert(message);
    } finally {
      setBusy(null);
    }
  };

  const submitAnswer = async () => {
    if (!session || !selectedQuestionId) return;
    const value = answer.trim();
    if (!value) {
      showAlert("답변을 입력해 주세요.", answerRef.current);
      return;
    }

    setBusy("answer");
    setError("");
    try {
      const result = await answerInterviewQuestion({
        sessionId: session.id,
        questionId: selectedQuestionId,
        answer: value,
      });
      setSession(result.session);
      setAnswer("");
      window.setTimeout(() => answerRef.current?.focus({ preventScroll: true }), 0);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "답변 코칭에 실패했습니다.";
      setError(message);
      showAlert(message, answerRef.current);
    } finally {
      setBusy(null);
    }
  };

  const complete = async () => {
    if (!session) return;
    if (!hasAnsweredEveryQuestion(session)) {
      showAlert("생성된 면접 질문에 한 번씩 답변한 뒤 결과를 확인할 수 있어요.");
      return;
    }

    setBusy("complete");
    setError("");
    try {
      const result = await completeInterviewCoaching({ sessionId: session.id });
      const anonymousId = getAnonymousId();
      router.push(
        `/ai-tools/interview-coaching/result/${result.session.id}?anonymousId=${encodeURIComponent(anonymousId)}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "면접 결과 생성에 실패했습니다.";
      setError(message);
      showAlert(message);
    } finally {
      setBusy(null);
    }
  };

  if (busy === "start") return <InterviewLoadingScreen />;

  const selectedQuestion = session?.questions.find((item) => item.id === selectedQuestionId) || null;
  const selectedMessages = session && selectedQuestion
    ? session.messages.filter((item) => item.questionId === selectedQuestion.id)
    : [];
  const followUpCount = selectedMessages.filter((item) => item.role === "follow_up").length;
  const canSubmitAnswer = Boolean(session && selectedQuestion && answer.trim()) && busy !== "answer";

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.frame}>
        <h1>NCS 직무 기반 AI 면접 코칭</h1>
        <p className={styles.lead}>
          지원 직무를 NCS 역량과 연결한 뒤, AI 면접 질문과 꼬리질문으로 답변을 연습해요.
        </p>

        {!session ? (
          <>
            {connectedJob ? (
              <ConnectedJobCard job={connectedJob} onRemove={() => setConnectedJob(null)} />
            ) : (
              <>
                <button className={styles.jobConnect} type="button" onClick={openJobPicker}>
                  + 지원 공고 연결하기 (선택)
                </button>
                <p className={styles.helper}>
                  공고를 연결하면 해당 직무에 맞춰 더 정확하게 코칭해요.
                  <br />
                  연결하지 않아도 직무명만으로 면접 코칭을 받을 수 있어요.
                </p>
              </>
            )}

            <section className={styles.manualCard}>
              <div className={styles.field}>
                <span>기업명</span>
                <input
                  value={manualCompanyName}
                  onChange={(event) => setManualCompanyName(event.target.value)}
                  onFocus={(event) => focusField(event.currentTarget)}
                  placeholder="예: 한국전력공사"
                  disabled={Boolean(connectedJob && !connectedJob.isManual)}
                />
              </div>
              <div className={styles.field}>
                <span>지원 직무</span>
                <input
                  value={manualPositionName}
                  onChange={(event) => setManualPositionName(event.target.value)}
                  onFocus={(event) => focusField(event.currentTarget)}
                  placeholder="예: 사무행정, 전기, 토목"
                  disabled={Boolean(connectedJob)}
                />
              </div>
              <div className={styles.field}>
                <span>직무</span>
                <textarea
                  value={manualDuty}
                  onChange={(event) => setManualDuty(event.target.value)}
                  onFocus={(event) => focusField(event.currentTarget)}
                  placeholder="면접 질문을 만들 직무 내용을 짧게 입력하세요."
                  disabled={Boolean(connectedJob)}
                />
              </div>
            </section>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button
              className={styles.primaryButton}
              type="button"
              onClick={start}
              disabled={busy !== null}
            >
              AI 면접 질문 만들기
            </button>
          </>
        ) : (
          <>
            <InterviewAnalysisView session={session} />
            {selectedQuestion ? (
              <section className={styles.sectionTitle}>
                <h2>AI 면접</h2>
                <small>꼬리질문 {followUpCount}/3</small>
              </section>
            ) : null}
            <QuestionTabs
              questions={session.questions}
              selectedQuestionId={selectedQuestionId}
              answeredQuestionIds={new Set(session.messages.filter((item) => item.role === "answer").map((item) => item.questionId || ""))}
              onSelect={(questionId) => {
                setSelectedQuestionId(questionId);
                setAnswer("");
              }}
            />
            {selectedQuestion ? (
              <InterviewQuestionPanel
                question={selectedQuestion}
                messages={selectedMessages}
                answer={answer}
                busy={busy}
                canSubmitAnswer={canSubmitAnswer}
                answerRef={answerRef}
                onAnswerChange={setAnswer}
                onSubmitAnswer={submitAnswer}
              />
            ) : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.bottomActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => selectNextQuestion(session, selectedQuestionId, setSelectedQuestionId)}
              >
                다음 질문
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={complete}
                disabled={busy !== null || !hasAnsweredEveryQuestion(session)}
              >
                최종 결과 보기
              </button>
            </div>
          </>
        )}
      </main>
      <AppFooter active="ai" />
      {jobPickerOpen ? (
        <JobPicker
          query={query}
          setQuery={setQuery}
          jobs={jobs}
          searching={searching}
          manualJobKeyword={manualJobKeyword}
          setManualJobKeyword={setManualJobKeyword}
          onSearch={() => searchJobs()}
          onPick={(item) => {
            setJobPickerOpen(false);
            setDutySheetJob(item);
          }}
          onManualConfirm={(title) => {
            setJobPickerOpen(false);
            setDutySheetJob({
              id: `manual:${title}`,
              institutionName: "직접 입력",
              title,
              applicationEndAt: null,
              isManual: true,
            });
          }}
          onClose={closeJobPicker}
        />
      ) : null}
      {dutySheetJob ? (
        <JobDutySheet
          job={dutySheetJob}
          onBack={() => {
            setDutySheetJob(null);
            setJobPickerOpen(true);
          }}
          onClose={() => {
            setDutySheetJob(null);
            closeJobPicker();
          }}
          onConfirm={(duty) => {
            setConnectedJob({ ...dutySheetJob, duty });
            if (dutySheetJob.isManual) {
              setManualPositionName(dutySheetJob.title);
              setManualDuty(duty);
            } else {
              setManualCompanyName(dutySheetJob.institutionName);
              setManualPositionName(dutySheetJob.title);
              setManualDuty(duty);
            }
            setDutySheetJob(null);
            closeJobPicker();
          }}
        />
      ) : null}
      {alertMessage ? (
        <AlertDialog
          message={alertMessage}
          onClose={() => {
            setAlertMessage("");
            window.setTimeout(() => focusField(alertFocusRef.current), 0);
          }}
        />
      ) : null}
    </div>
  );
}

function InterviewAnalysisView({ session }: { session: InterviewCoachingSession }) {
  const profile = session.analysis.profile;
  return (
    <>
      <section className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <span>직무 내용 분석</span>
          <strong>{session.companyName} · {session.positionName}</strong>
          <p>{session.dutyText}</p>
        </div>
        {profile.keywords.length ? (
          <div className={styles.keywordList}>
            {profile.keywords.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : null}
        <div className={styles.profileGrid}>
          <ProfileList title="주요 업무" items={profile.mainTasks} />
          <ProfileList title="필요 지식/경험" items={[...profile.requiredKnowledge, ...profile.preferredExperience].slice(0, 5)} />
        </div>
      </section>
      <section className={styles.sectionTitle}>
        <h2>NCS 직무/관련 영역 매핑</h2>
        <small>7개 영역</small>
      </section>
      <section className={styles.ncsPanel}>
        {session.analysis.ncsMappings.map((item) => (
          <article className={styles.ncsItem} key={item.name}>
            <strong>{item.name}<b>{item.relevance}%</b></strong>
            <div className={styles.track} aria-hidden="true"><span style={{ width: `${item.relevance}%` }} /></div>
            <p>{item.reason}</p>
          </article>
        ))}
      </section>
    </>
  );
}

function ProfileList({ title, items }: { title: string; items: string[] }) {
  return (
    <article>
      <h3>{title}</h3>
      {items.length ? (
        <ul>{items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>
      ) : (
        <ul><li>AI가 면접 질문 생성에 필요한 핵심 정보를 정리합니다.</li></ul>
      )}
    </article>
  );
}

function QuestionTabs({
  questions,
  selectedQuestionId,
  answeredQuestionIds,
  onSelect,
}: {
  questions: InterviewQuestion[];
  selectedQuestionId: string;
  answeredQuestionIds: Set<string>;
  onSelect: (questionId: string) => void;
}) {
  return (
    <div className={styles.questionTabs} aria-label="면접 질문 선택">
      {questions.map((question, index) => (
        <button
          key={question.id}
          type="button"
          className={question.id === selectedQuestionId ? styles.questionActive : undefined}
          onClick={() => onSelect(question.id)}
        >
          {answeredQuestionIds.has(question.id) ? "✓ " : ""}Q{index + 1}
        </button>
      ))}
    </div>
  );
}

function InterviewQuestionPanel({
  question,
  messages,
  answer,
  busy,
  canSubmitAnswer,
  answerRef,
  onAnswerChange,
  onSubmitAnswer,
}: {
  question: InterviewQuestion;
  messages: InterviewMessage[];
  answer: string;
  busy: "start" | "answer" | "complete" | null;
  canSubmitAnswer: boolean;
  answerRef: RefObject<HTMLTextAreaElement | null>;
  onAnswerChange: (value: string) => void;
  onSubmitAnswer: () => void;
}) {
  const latestFollowUp = [...messages].reverse().find((item) => item.role === "follow_up");
  const prompt = latestFollowUp?.content || question.question;
  return (
    <section className={styles.interviewPanel}>
      <article className={styles.questionCard}>
        <div className={styles.questionMeta}>
          <span>{question.difficulty} · {formatQuestionType(question.type)}</span>
          <span>{latestFollowUp ? `꼬리질문 ${latestFollowUp.followUpIndex}` : "기본 질문"}</span>
        </div>
        <h2>{prompt}</h2>
        <p>{question.intent}</p>
        <div className={styles.badgeList}>
          {question.ncsAreas.map((area) => <span key={area}>{area}</span>)}
        </div>
      </article>
      {messages.length ? (
        <div className={styles.chatList}>
          {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
        </div>
      ) : null}
      <div className={styles.answerBox}>
        <textarea
          ref={answerRef}
          value={answer}
          maxLength={MAX_ANSWER_LENGTH}
          onChange={(event) => onAnswerChange(event.target.value)}
          onFocus={(event) => focusField(event.currentTarget)}
          placeholder="면접장에서 말하듯 답변을 적어보세요."
        />
        <div className={styles.answerFooter}>
          <span>{answer.length.toLocaleString("ko-KR")} / {MAX_ANSWER_LENGTH.toLocaleString("ko-KR")}자</span>
          <button type="button" onClick={onSubmitAnswer} disabled={!canSubmitAnswer}>
            {busy === "answer" ? "코칭 중" : "답변 제출"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ChatMessage({ message }: { message: InterviewMessage }) {
  const label = message.role === "answer"
    ? "내 답변"
    : message.role === "follow_up"
      ? `꼬리질문 ${message.followUpIndex || ""}`
      : "AI 질문";
  return (
    <article className={`${styles.chatBubble} ${message.role === "answer" ? styles.chatAnswer : ""} ${message.role === "follow_up" ? styles.chatFollow : ""}`}>
      <strong>{label}</strong>
      <p>{message.content}</p>
      {message.feedback ? (
        <div className={styles.feedback}>
          <b>{message.feedback.summary}</b>
          <ul>
            {message.feedback.strengths.slice(0, 2).map((item) => <li key={`s-${item}`}>{item}</li>)}
            {message.feedback.improvements.slice(0, 2).map((item) => <li key={`i-${item}`}>{item}</li>)}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function ConnectedJobCard({ job, onRemove }: { job: ConnectedJob; onRemove: () => void }) {
  return (
    <section className={styles.connectedJobCard}>
      <button type="button" onClick={onRemove} aria-label="지원 공고 연결 해제">
        <Image src="/coaching/close-rounded.svg" alt="" width={24} height={24} />
      </button>
      <span>지원 공고</span>
      <strong>{formatConnectedJobTitle(job)}</strong>
      <em>직무</em>
      <p>{job.duty}</p>
    </section>
  );
}

function JobPicker({
  query,
  setQuery,
  jobs,
  searching,
  manualJobKeyword,
  setManualJobKeyword,
  onSearch,
  onPick,
  onManualConfirm,
  onClose,
}: {
  query: string;
  setQuery: (value: string) => void;
  jobs: InterviewCoachingJob[];
  searching: boolean;
  manualJobKeyword: string;
  setManualJobKeyword: (value: string) => void;
  onSearch: () => void;
  onPick: (job: InterviewCoachingJob) => void;
  onManualConfirm: (title: string) => void;
  onClose: () => void;
}) {
  const manualTitle = manualJobKeyword.trim();
  return (
    <div className={styles.overlay}>
      <section className={styles.modal}>
        <div className={styles.sheetHandle} />
        <header>
          <h2>연결할 공고 선택</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className={styles.search}>
          <input
            value={query}
            onFocus={(event) => focusField(event.currentTarget)}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!jobs.length) setManualJobKeyword(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder="기업명이나, 공고명을 입력하세요."
          />
          <button type="button" onClick={onSearch}>검색</button>
        </div>
        {!searching && !jobs.length ? <p className={styles.jobResultCount}>검색결과 0</p> : null}
        <div className={styles.jobResults}>
          {searching ? (
            <p>공고를 찾는 중...</p>
          ) : jobs.length ? (
            jobs.map((item) => (
              <button type="button" key={item.id} onClick={() => onPick(item)}>
                <span>{item.institutionName}</span>
                <strong>{item.title}</strong>
                <small>~ {item.applicationEndAt ? new Date(item.applicationEndAt).toLocaleDateString("ko-KR") : "상시채용"}</small>
              </button>
            ))
          ) : (
            <div className={styles.noJobResult}>
              <strong>검색결과가 없습니다.</strong>
              <p>공고가 나오지 않는다면 직접 입력하거나,<br />재검색하세요.</p>
              <input
                value={manualJobKeyword}
                onFocus={(event) => focusField(event.currentTarget)}
                onChange={(event) => setManualJobKeyword(event.target.value)}
                placeholder="기업명이나, 공고명을 입력하세요."
              />
              <button type="button" disabled={!manualTitle} onClick={() => onManualConfirm(manualTitle)}>
                공고 입력 완료
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function JobDutySheet({
  job,
  onBack,
  onClose,
  onConfirm,
}: {
  job: InterviewCoachingJob;
  onBack: () => void;
  onClose: () => void;
  onConfirm: (duty: string) => void;
}) {
  const [duty, setDuty] = useState("");
  return (
    <div className={styles.overlay}>
      <section className={styles.modal}>
        <div className={styles.sheetHandle} />
        <header>
          <button type="button" onClick={onBack} aria-label="이전">‹</button>
          <h2>직무</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className={styles.jobDutySelected}>
          <span>{job.isManual ? "직접 입력한 공고" : job.institutionName}</span>
          <strong>{formatConnectedJobTitle(job)}</strong>
        </div>
        <label className={styles.jobDutyLabel}>직무</label>
        <input
          className={styles.jobDutyInput}
          value={duty}
          onFocus={(event) => focusField(event.currentTarget)}
          onChange={(event) => setDuty(event.target.value)}
          placeholder="직무를 입력하세요."
        />
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!duty.trim()}
          onClick={() => onConfirm(duty.trim())}
        >
          공고 연결하기
        </button>
      </section>
    </div>
  );
}

function AlertDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className={styles.dialogOverlay} role="alertdialog" aria-modal="true">
      <section className={styles.alertDialog}>
        <h2>{message}</h2>
        <button type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  );
}

function InterviewLoadingScreen() {
  return (
    <div className={styles.loadingPage}>
      <main className={styles.loadingFrame} aria-live="polite" aria-busy="true">
        <Image src="/coaching/coaching-loading-owl.png" alt="" width={114} height={140} priority />
        <h1>직무와 NCS 역량을 분석하고 있어요.</h1>
        <p>곧 실전 면접 질문을 만들어 드릴게요.</p>
        <div className={styles.loadingTrack} aria-hidden="true"><span /></div>
      </main>
    </div>
  );
}

function selectNextQuestion(
  session: InterviewCoachingSession,
  currentId: string,
  setter: (questionId: string) => void,
) {
  const currentIndex = Math.max(0, session.questions.findIndex((item) => item.id === currentId));
  const next = session.questions[(currentIndex + 1) % session.questions.length];
  if (next) setter(next.id);
}

function hasAnsweredEveryQuestion(session: InterviewCoachingSession) {
  const answered = new Set(
    session.messages.filter((item) => item.role === "answer").map((item) => item.questionId),
  );
  return session.questions.length > 0 && session.questions.every((item) => answered.has(item.id));
}

function formatConnectedJobTitle(job: InterviewCoachingJob) {
  return job.isManual ? job.title : `[${job.institutionName}] ${job.title}`;
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
      return "인성·가치관";
    case "ethics":
      return "직업윤리";
    default:
      return "면접질문";
  }
}

function focusField(element?: HTMLElement | null) {
  if (!element) return;
  if ("focus" in element) element.focus({ preventScroll: true });
  focusMobileInput(element);
}
