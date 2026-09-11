"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getJobPostings } from "@/features/home/home.api";
import { getAnonymousId } from "@/shared/session/anonymous-id";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { focusMobileInput, watchMobileKeyboardInset } from "@/shared/mobile-focus";
import {
  answerInterviewQuestion,
  completeInterviewCoaching,
  getInterviewCoachingSession,
  startInterviewCoaching,
} from "../interview-coaching.api";
import type {
  InterviewCoachingJob,
  InterviewCoachingSession,
  InterviewMessage,
  InterviewNcsMapping,
  InterviewQuestion,
  NcsAreaName,
} from "../interview-coaching.dto";
import styles from "./InterviewCoachingPage.module.css";

type ConnectedJob = InterviewCoachingJob & { duty: string };

const MAX_ANSWER_LENGTH = 4000;
const MAX_FOLLOW_UPS_PER_QUESTION = 3;
const NCS_AREA_NAMES: NcsAreaName[] = [
  "의사소통능력",
  "수리능력",
  "문제해결능력",
  "자기개발능력",
  "대인관계능력",
  "정보능력",
  "직업윤리",
];

export function InterviewCoachingPage({
  initialSessionId,
  initialAnonymousId,
  allowCompletedView = false,
}: {
  initialSessionId?: string;
  initialAnonymousId?: string | null;
  allowCompletedView?: boolean;
} = {}) {
  const router = useRouter();
  const jobSearchSeqRef = useRef(0);
  const answerRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
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
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "start" | "complete" | null>(
    initialSessionId ? "load" : null,
  );
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  useBodyScrollLock(Boolean(jobPickerOpen || dutySheetJob || alertMessage || completeConfirmOpen || busyQuestionId));

  useEffect(() => {
    if (!jobPickerOpen && !dutySheetJob && !alertMessage && !completeConfirmOpen && !busyQuestionId) return;
    return watchMobileKeyboardInset();
  }, [jobPickerOpen, dutySheetJob, alertMessage, completeConfirmOpen, busyQuestionId]);

  useEffect(() => {
    if (!initialSessionId) return;
    let active = true;
    getInterviewCoachingSession(initialSessionId, initialAnonymousId || getAnonymousId())
      .then((response) => {
        if (!active) return;
        if (!allowCompletedView && (response.session.result || response.session.completedAt)) {
          const anonymousId = initialAnonymousId || getAnonymousId();
          router.replace(
            `/ai-tools/interview-coaching/result/${response.session.id}?anonymousId=${encodeURIComponent(anonymousId)}`,
          );
          return;
        }
        setSession(response.session);
      })
      .catch((caught) => {
        if (!active) return;
        const message = caught instanceof Error ? caught.message : "AI NCS 면접 코칭 기록을 불러오지 못했습니다.";
        setError(message);
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [allowCompletedView, initialAnonymousId, initialSessionId, router]);

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
        includeClosedMonths: 6,
      });
      if (searchId !== jobSearchSeqRef.current) return;
      const activeJobs = result.items
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
      setActiveQuestionId(result.session.questions[0]?.id || null);
      scrollToPageTop();
      window.requestAnimationFrame(scrollToPageTop);
      window.setTimeout(scrollToPageTop, 0);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "AI NCS 면접 코칭을 시작하지 못했습니다.";
      setError(message);
      showAlert(message);
    } finally {
      setBusy(null);
    }
  };

  const submitAnswer = async (questionId: string) => {
    if (!session) return;
    if (session.completedAt || session.result) {
      showAlert("최종 결과가 생성된 면접 코칭은 답변을 추가할 수 없습니다.");
      return;
    }
    const value = (answerDrafts[questionId] || "").trim();
    if (!value) {
      showAlert("답변을 입력해 주세요.", answerRefs.current[questionId]);
      return;
    }

    setBusyQuestionId(questionId);
    setError("");
    try {
      const result = await answerInterviewQuestion({
        sessionId: session.id,
        questionId,
        answer: value,
      });
      setSession(result.session);
      setAnswerDrafts((drafts) => ({ ...drafts, [questionId]: "" }));
      window.setTimeout(() => answerRefs.current[questionId]?.focus({ preventScroll: true }), 0);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "답변 코칭에 실패했습니다.";
      setError(message);
      showAlert(message, answerRefs.current[questionId]);
    } finally {
      setBusyQuestionId(null);
    }
  };

  const requestComplete = () => {
    if (!session) return;
    const anonymousId = getAnonymousId();
    if (session.result) {
      router.push(
        `/ai-tools/interview-coaching/result/${session.id}?anonymousId=${encodeURIComponent(anonymousId)}`,
      );
      return;
    }
    if (!hasAnsweredAnyQuestion(session)) {
      showAlert("면접 답변을 하나 이상 제출하면 결과를 확인할 수 있어요.");
      return;
    }
    setCompleteConfirmOpen(true);
  };

  const complete = async () => {
    if (!session) return;
    const anonymousId = getAnonymousId();
    setBusy("complete");
    setError("");
    try {
      const result = await completeInterviewCoaching({ sessionId: session.id });
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

  const selectedQuestionId = session?.questions.some((item) => item.id === activeQuestionId)
    ? activeQuestionId || ""
    : session?.questions[0]?.id || "";
  const isInputScreen = busy !== "load" && !session;

  if (busy === "start" || busy === "complete") return <InterviewLoadingScreen mode={busy} />;

  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={`${styles.frame} ${isInputScreen ? styles.inputFrame : ""}`}>
        <h1>AI NCS 면접 코칭</h1>
        <p className={styles.lead}>
          지원 직무를 NCS 역량과 연결한 뒤, AI 면접 질문과 꼬리질문으로 답변을 연습해요.
        </p>
        {busy === "load" ? <p className={styles.lead}>저장된 AI NCS 면접 코칭 기록을 불러오고 있어요.</p> : null}

        {busy === "load" ? null : !session ? (
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
                  연결하지 않아도 직무명만으로 AI NCS 면접 코칭을 받을 수 있어요.
                </p>
              </>
            )}

            {!connectedJob ? (
              <section className={styles.manualCard}>
                <div className={styles.field}>
                  <span>기업명</span>
                  <input
                    value={manualCompanyName}
                    onChange={(event) => setManualCompanyName(event.target.value)}
                    onFocus={(event) => focusField(event.currentTarget)}
                    placeholder="예: 한국전력공사"
                  />
                </div>
                <div className={styles.field}>
                  <span>지원 직무</span>
                  <input
                    value={manualPositionName}
                    onChange={(event) => setManualPositionName(event.target.value)}
                    onFocus={(event) => focusField(event.currentTarget)}
                    placeholder="예: 사무행정, 전기, 토목"
                  />
                </div>
                <div className={styles.field}>
                  <span>직무</span>
                  <textarea
                    value={manualDuty}
                    onChange={(event) => setManualDuty(event.target.value)}
                    onFocus={(event) => focusField(event.currentTarget)}
                    placeholder="예: 민원 응대, 예산 정산, 자료 검토, 보고서 작성 등 실제 수행할 업무를 입력해 주세요."
                  />
                </div>
                <p className={styles.manualNotice}>
                  직접 입력 시에는 실제 채용공고의 자격요건, 우대사항, 전형 정보가 반영되지 않고 입력한 기업명과 직무 내용을 기준으로 질문이 생성됩니다. 더 정확한 코칭을 원하면 지원 공고를 연결해 주세요.
                </p>
              </section>
            ) : null}
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
            <section className={styles.sectionTitle}>
              <h2>AI 면접</h2>
              <small>문항별 꼬리질문 최대 3개</small>
            </section>
            <QuestionTabs
              questions={session.questions}
              messages={session.messages}
              activeQuestionId={selectedQuestionId}
              onSelect={setActiveQuestionId}
            />
            <div className={styles.questionList}>
              {session.questions
                .filter((question) => question.id === selectedQuestionId)
                .map((question) => {
                const index = session.questions.findIndex((item) => item.id === question.id);
                const messages = session.messages.filter((item) => item.questionId === question.id);
                const followUpCount = messages.filter((item) => item.role === "follow_up").length;
                const latestMessage = [...messages]
                  .reverse()
                  .find((item) => item.role === "answer" || item.role === "follow_up");
                const isQuestionCompleted =
                  followUpCount >= MAX_FOLLOW_UPS_PER_QUESTION &&
                  latestMessage?.role === "answer";
                const answer = answerDrafts[question.id] || "";
                const mappedAreas = getQuestionBadgeAreas(question, session.analysis.ncsMappings, index);
                const readonly = Boolean(session.completedAt || session.result || isQuestionCompleted);
                return (
                  <InterviewQuestionPanel
                    key={question.id}
                    index={index}
                    question={question}
                    mappedAreas={mappedAreas}
                    messages={messages}
                    answer={answer}
                    busy={busyQuestionId === question.id}
                    readonly={readonly}
                    readonlyReason={
                      isQuestionCompleted && !session.completedAt && !session.result
                        ? "이 문항은 꼬리질문 3개 답변까지 완료되어 더 이상 답변을 추가할 수 없습니다."
                        : "최종 결과가 생성된 면접 코칭입니다. 답변을 추가하거나 수정할 수 없습니다."
                    }
                    canSubmitAnswer={Boolean(answer.trim()) && !busyQuestionId && busy !== "complete" && !readonly}
                    followUpCount={followUpCount}
                    answerRef={(element) => {
                      answerRefs.current[question.id] = element;
                    }}
                    onAnswerChange={(value) => {
                      setAnswerDrafts((drafts) => ({ ...drafts, [question.id]: value }));
                    }}
                    onSubmitAnswer={() => submitAnswer(question.id)}
                  />
                );
              })}
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.singleBottomAction}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={requestComplete}
                disabled={busy !== null || (!session.result && !hasAnsweredAnyQuestion(session))}
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
            setManualCompanyName("");
            setManualPositionName("");
            setManualDuty("");
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
      {completeConfirmOpen ? (
        <ConfirmDialog
          title="최종 결과를 생성할까요?"
          message="최종 결과를 생성하면 이 면접 코칭은 완료 처리되어 더 이상 답변을 추가하거나 수정할 수 없습니다."
          cancelLabel="아니오"
          confirmLabel="네"
          onCancel={() => setCompleteConfirmOpen(false)}
          onConfirm={() => {
            setCompleteConfirmOpen(false);
            void complete();
          }}
        />
      ) : null}
      {busyQuestionId ? <AnswerLoadingOverlay /> : null}
    </div>
  );
}

export function InterviewAnalysisView({
  session,
  mode = "full",
  profileTitle = "직무 내용 분석",
  ncsTitle = "NCS 직무/관련 영역 매핑",
}: {
  session: InterviewCoachingSession;
  mode?: "full" | "profile" | "ncs";
  profileTitle?: string;
  ncsTitle?: string;
}) {
  const profile = session.analysis.profile;
  const visibleMappings = getVisibleNcsMappings(session.analysis.ncsMappings);
  const displayPositionName = cleanDisplayText(session.positionName) || session.positionName;
  const displayDutyText = cleanDisplayText(session.dutyText) || session.dutyText;
  const displayKeywords = compactDisplayKeywords(profile.keywords, [
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
    <>
      {mode !== "ncs" ? <section className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <span>{profileTitle}</span>
          <strong>{session.companyName} · {displayPositionName}</strong>
          <p>{displayDutyText}</p>
        </div>
        {displayKeywords.length ? (
          <div className={styles.keywordList}>
            {displayKeywords.map((item) => <span key={item}>{item}</span>)}
          </div>
        ) : null}
        <div className={styles.profileGrid}>
          <ProfileList title="주요 업무" items={displayMainTasks} />
          <ProfileList title="필요 지식/경험" items={displayKnowledge} />
        </div>
      </section> : null}
      {mode !== "profile" ? <section className={styles.sectionTitle}>
        <h2>{ncsTitle}</h2>
        <small>{visibleMappings.length}개 매칭</small>
      </section> : null}
      {mode !== "profile" ? <section className={styles.ncsPanel}>
        {visibleMappings.map((item) => (
          <article className={styles.ncsItem} key={item.name}>
            <strong>{item.name}<b>{item.relevance}%</b></strong>
            <div className={styles.track} aria-hidden="true"><span style={{ width: `${item.relevance}%` }} /></div>
            <p>{cleanDisplayText(item.reason) || item.reason}</p>
          </article>
        ))}
        {!visibleMappings.length ? (
          <p>AI가 생성한 NCS 매핑 결과가 없습니다.</p>
        ) : null}
      </section> : null}
    </>
  );
}

function getVisibleNcsMappings(mappings: InterviewNcsMapping[]) {
  return [...mappings].sort((left, right) => right.relevance - left.relevance);
}

function getQuestionBadgeAreas(
  question: InterviewQuestion,
  mappings: InterviewNcsMapping[],
  index: number,
) {
  const visibleMappings = getVisibleNcsMappings(mappings);
  const visibleNames = new Set(visibleMappings.map((item) => item.name));
  const matched = question.ncsAreas.filter((area) => visibleNames.has(area));
  return matched.length
    ? matched
    : visibleMappings[index % Math.max(visibleMappings.length, 1)]
      ? [visibleMappings[index % Math.max(visibleMappings.length, 1)].name]
      : [];
}

function QuestionTabs({
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
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    scrollLeft: 0,
  });
  const answered = new Set(
    messages.filter((item) => item.role === "answer").map((item) => item.questionId),
  );

  useEffect(() => {
    const list = tabListRef.current;
    const button = activeButtonRef.current;
    if (!list || !button) return;
    const left = button.offsetLeft - Math.max(0, (list.clientWidth - button.offsetWidth) / 2);
    list.scrollTo({
      left: Math.max(0, left),
      behavior: "smooth",
    });
  }, [activeQuestionId]);

  useEffect(() => {
    const updatePinnedState = () => {
      const anchor = anchorRef.current;
      const shell = shellRef.current;
      if (!anchor || !shell) return;
      const headerHeight = 48;
      setPinnedHeight(shell.offsetHeight);
      setIsPinned(anchor.getBoundingClientRect().top <= headerHeight);
    };

    updatePinnedState();
    window.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", updatePinnedState);
    return () => {
      window.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", updatePinnedState);
    };
  }, []);

  const scrollTabs = (direction: -1 | 1) => {
    const list = tabListRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * Math.max(list.clientWidth * 0.75, 220),
      behavior: "smooth",
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const list = tabListRef.current;
    if (!list) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    list.scrollLeft += delta;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const list = tabListRef.current;
    if (!list) return;
    if (event.pointerType === "mouse") return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button")) return;
    dragRef.current = {
      dragging: true,
      startX: event.clientX,
      scrollLeft: list.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const list = tabListRef.current;
    if (!list || !dragRef.current.dragging) return;
    const distance = event.clientX - dragRef.current.startX;
    list.scrollLeft = dragRef.current.scrollLeft - distance;
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current.dragging = false;
  };

  return (
    <>
    <div
      ref={anchorRef}
      className={styles.questionTabsAnchor}
      style={{ height: isPinned ? pinnedHeight : 0 }}
      aria-hidden="true"
    />
    <div
      ref={shellRef}
      className={`${styles.questionTabsShell} ${isPinned ? styles.questionTabsFixed : ""}`}
    >
      <button
        className={styles.questionTabsControl}
        type="button"
        onClick={() => scrollTabs(-1)}
        aria-label="이전 질문 탭 보기"
      >
        {"<"}
      </button>
      <nav
        ref={tabListRef}
        className={styles.questionTabs}
        aria-label="면접 질문 선택"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
      >
        {questions.map((question, index) => {
          const isActive = question.id === activeQuestionId;
          const isAnswered = answered.has(question.id);
          return (
            <button
              key={question.id}
              ref={isActive ? activeButtonRef : undefined}
              className={`${isActive ? styles.questionTabActive : ""} ${isAnswered ? styles.questionTabAnswered : ""}`}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                onSelect(question.id);
              }}
              aria-current={isActive ? "true" : undefined}
              title={`질문 ${index + 1}`}
            >
              Q{index + 1}
            </button>
          );
        })}
      </nav>
      <button
        className={styles.questionTabsControl}
        type="button"
        onClick={() => scrollTabs(1)}
        aria-label="다음 질문 탭 보기"
      >
        {">"}
      </button>
    </div>
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
        <ul><li>연결한 공고 기준으로 직무 정보를 분석 중입니다.</li></ul>
      )}
    </article>
  );
}

function InterviewQuestionPanel({
  index,
  question,
  mappedAreas,
  messages,
  answer,
  busy,
  readonly,
  readonlyReason,
  canSubmitAnswer,
  followUpCount,
  answerRef,
  onAnswerChange,
  onSubmitAnswer,
}: {
  index: number;
  question: InterviewQuestion;
  mappedAreas: InterviewQuestion["ncsAreas"];
  messages: InterviewMessage[];
  answer: string;
  busy: boolean;
  readonly: boolean;
  readonlyReason: string;
  canSubmitAnswer: boolean;
  followUpCount: number;
  answerRef: (element: HTMLTextAreaElement | null) => void;
  onAnswerChange: (value: string) => void;
  onSubmitAnswer: () => void;
}) {
  const prompt = cleanDisplayText(question.question) || question.question;
  const intent = cleanDisplayText(question.intent) || question.intent;
  const visibleMessages = messages.filter((item) => item.role === "answer" || item.role === "follow_up");
  const latestMessage = [...visibleMessages].reverse()[0];
  const isAnsweringFollowUp = latestMessage?.role === "follow_up";
  const answerTargetLabel = isAnsweringFollowUp
    ? `꼬리질문 ${latestMessage.followUpIndex || followUpCount} 답변`
    : "답변 작성";
  const answerPlaceholder = isAnsweringFollowUp
    ? "위 꼬리질문에 대해 면접장에서 말하듯 답변해 보세요."
    : "면접장에서 말하듯 답변을 적어보세요.";
  return (
    <section className={styles.interviewPanel}>
      <article className={styles.questionCard}>
        <div className={styles.questionMeta}>
          <span>질문 {index + 1} · {question.difficulty} · {formatQuestionType(question.type)}</span>
          <span>꼬리질문 {followUpCount}/3</span>
        </div>
        <h2>{prompt}</h2>
        <p>{intent}</p>
        <div className={styles.badgeList}>
          {mappedAreas.map((area) => <span key={area}>{area}</span>)}
        </div>
      </article>
      {visibleMessages.length ? (
        <div className={styles.chatList}>
          {visibleMessages.map((message, messageIndex) => (
            <ChatMessage
              key={message.id}
              message={message}
              ncsAreas={message.role === "follow_up" ? getFollowUpNcsAreas(visibleMessages, messageIndex) : []}
              showFeedback={false}
            />
          ))}
        </div>
      ) : null}
      {readonly ? (
        <div className={styles.answerLockedBox}>
          {readonlyReason}
        </div>
      ) : (
        <div className={styles.answerBox}>
          <div className={styles.answerPrompt}>
            <strong>{answerTargetLabel}</strong>
          </div>
          <textarea
            ref={answerRef}
            value={answer}
            maxLength={MAX_ANSWER_LENGTH}
            onChange={(event) => onAnswerChange(event.target.value)}
            onFocus={(event) => focusField(event.currentTarget)}
            placeholder={answerPlaceholder}
          />
          <div className={styles.answerFooter}>
            <span>{answer.length.toLocaleString("ko-KR")} / {MAX_ANSWER_LENGTH.toLocaleString("ko-KR")}자</span>
            <button type="button" onClick={onSubmitAnswer} disabled={!canSubmitAnswer}>
              {busy ? "코칭 중" : "답변 제출"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ChatMessage({
  message,
  ncsAreas = [],
  showFeedback = true,
}: {
  message: InterviewMessage;
  ncsAreas?: InterviewQuestion["ncsAreas"];
  showFeedback?: boolean;
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
      {showFeedback && message.feedback ? (
        <div className={styles.feedback}>
          <b>{cleanDisplayText(message.feedback.summary) || message.feedback.summary}</b>
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
      <section data-keyboard-sheet="true" className={styles.modal}>
        <div className={styles.sheetHandle} />
        <header>
          <h2>연결할 공고 선택</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className={styles.search}>
          <input
            value={query}
            onFocus={(event) => focusSheetField(event.currentTarget)}
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
                onFocus={(event) => focusSheetField(event.currentTarget)}
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
      <section data-keyboard-sheet="true" className={styles.modal}>
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
          onFocus={(event) => focusSheetField(event.currentTarget)}
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

function ConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.dialogOverlay} role="alertdialog" aria-modal="true">
      <section className={styles.alertDialog}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className={styles.confirmActions}>
          <button type="button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function InterviewLoadingScreen({ mode }: { mode: "start" | "complete" }) {
  const isCompleting = mode === "complete";
  return (
    <div className={styles.loadingPage}>
      <main className={styles.loadingFrame} aria-live="polite" aria-busy="true">
        <Image src="/coaching/coaching-loading-owl.png" alt="" width={114} height={140} priority />
        <h1>{isCompleting ? "면접 답변을 종합하고 있어요." : "직무와 NCS 역량을 분석하고 있어요."}</h1>
        <p>{isCompleting ? "곧 AI NCS 면접 코칭 결과를 보여드릴게요." : "곧 실전 면접 질문을 만들어 드릴게요."}</p>
        <div className={styles.loadingTrack} aria-hidden="true"><span /></div>
      </main>
    </div>
  );
}

function AnswerLoadingOverlay() {
  return (
    <div className={styles.answerLoadingOverlay} role="status" aria-live="polite">
      <span className={styles.answerLoadingSpinner} aria-hidden="true" />
      <p className={styles.answerLoadingText}>답변을 분석하고 꼬리질문을 만들고 있어요.</p>
    </div>
  );
}

function hasAnsweredAnyQuestion(session: InterviewCoachingSession) {
  return session.messages.some((item) => item.role === "answer");
}

function formatConnectedJobTitle(job: InterviewCoachingJob) {
  return job.isManual ? job.title : `[${job.institutionName}] ${job.title}`;
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

function compactDisplayKeywords(items: string[], hiddenContexts: string[]) {
  const cleaned = cleanDisplayList(items)
    .flatMap((item) => item.split(/[\/|,]/))
    .map((item) => cleanDisplayText(item))
    .filter(Boolean);
  const contextText = hiddenContexts.map(cleanDisplayText).join(" ");
  const unique = Array.from(new Set(cleaned)).filter((item) => {
    if (hiddenContexts.map(cleanDisplayText).includes(item)) return false;
    if (item.length < 2) return false;
    const tokenPattern = new RegExp(`(^|[\\s./·()])${escapeRegExp(item)}($|[\\s./·()])`);
    const coveredByLongerKeyword = cleaned.some(
      (other) => other !== item && other.length > item.length && tokenPattern.test(other),
    );
    const coveredByContext = tokenPattern.test(contextText);
    return !coveredByLongerKeyword && !coveredByContext;
  });
  return unique.slice(0, 5);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function scrollToPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
