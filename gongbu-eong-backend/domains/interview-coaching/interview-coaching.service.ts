import { createOpenAiJsonResponse, getOpenAiModel } from "@/lib/openai";
import type { JobPostingDetailRow } from "@/domains/jobs/jobs.repository";
import {
  addInterviewMessage,
  claimAnonymousInterviewSessions,
  createInterviewSession,
  findInterviewSessionForViewer,
  listInterviewHistory,
  markInterviewSessionFailed,
  updateInterviewMessageFeedback,
  updateInterviewResult,
  updateInterviewSessionAnalysis,
} from "./interview-coaching.repository";
import type {
  InterviewAnalysis,
  InterviewAnswerFeedback,
  InterviewCoachingJobDto,
  InterviewCoachingResult,
  InterviewQuestion,
  NcsAreaName,
} from "./interview-coaching.dto";

const NCS_AREAS: Array<{
  name: NcsAreaName;
  description: string;
}> = [
  { name: "의사소통능력", description: "문서 이해, 문서 작성, 경청, 표현 능력" },
  { name: "수리능력", description: "기초 연산, 자료 해석, 통계와 도표 이해" },
  { name: "문제해결능력", description: "문제 정의, 원인 분석, 대안 선택, 실행" },
  { name: "자기개발능력", description: "학습, 자기관리, 경력개발, 성장 태도" },
  { name: "대인관계능력", description: "팀워크, 갈등관리, 리더십, 협업" },
  { name: "정보능력", description: "정보 수집, 정보 분석, 컴퓨터 활용" },
  { name: "직업윤리", description: "책임감, 규정 준수, 공공성, 안전의식" },
];

const MAX_FOLLOW_UPS_PER_QUESTION = 3;
const INTERVIEW_QUESTION_COUNT = 20;

type InterviewStartInput = {
  companyName: string;
  positionName: string;
  dutyText: string;
  jobContext: string;
};

export type StartInterviewCoachingArgs = {
  userId?: string | null;
  anonymousId?: string | null;
  posting?: JobPostingDetailRow | null;
  manualCompanyName?: string | null;
  manualPositionName?: string | null;
  jobDuty?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
};

function resolveInterviewInput(args: StartInterviewCoachingArgs) {
  const job = args.posting ? makeJobSnapshot(args.posting) : null;
  const manualCompanyName = cleanText(args.manualCompanyName).slice(0, 100);
  const manualPositionName = cleanJobLabel(args.manualPositionName).slice(0, 100);
  const submittedDutyText = cleanText(args.jobDuty);
  const meaningfulDutyText = isMeaningfulDutyText(submittedDutyText)
    ? cleanJobLabel(submittedDutyText).slice(0, 400)
    : "";
  const postingJobCategory = cleanJobLabel(args.posting?.job_category);
  const postingNcsCategory = cleanJobLabel(args.posting?.ncs_category);
  const postingCategories = (args.posting?.categories || [])
    .map(cleanJobLabel)
    .filter(Boolean);
  const postingPositionName = args.posting
    ? [
      meaningfulDutyText,
      postingJobCategory,
      postingNcsCategory,
      ...postingCategories,
      removeJobCodesFromText(args.posting.title),
    ].map((item) => item.slice(0, 120)).find(Boolean) || ""
    : "";
  const postingDutyText = args.posting
    ? uniqueDisplaySegments([
      meaningfulDutyText,
      postingJobCategory,
      postingNcsCategory,
      ...postingCategories,
    ]).join(" / ").slice(0, 400)
    : "";

  return {
    job,
    companyName: job?.institutionName || manualCompanyName,
    positionName: args.posting
      ? meaningfulDutyText || postingPositionName || manualPositionName
      : meaningfulDutyText || manualPositionName,
    dutyText: args.posting
      ? meaningfulDutyText || postingDutyText || postingPositionName || manualPositionName
      : meaningfulDutyText || manualPositionName,
  };
}

function isMeaningfulDutyText(value: string) {
  const text = value.trim();
  if (!text) return false;
  const normalized = cleanJobLabel(text).toLowerCase().replace(/\s+/g, "");
  if (!normalized) return false;
  return ![
    "test",
    "testing",
    "테스트",
    "직무",
    "없음",
    "없습니다",
    "na",
    "n/a",
    "-",
    ".",
  ].includes(normalized);
}

function cleanJobLabel(value?: string | null) {
  const text = removeJobCodesFromText(value);
  if (!text) return "";
  const parts = text
    .split(/[\/|,]/)
    .map((item) => item.trim())
    .filter((item) => item && !isJobCodeToken(item));

  return (parts.length ? parts.join(" / ") : isJobCodeToken(text) ? "" : text)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeJobCodesFromText(value?: string | null) {
  return cleanText(value)
    .replace(/\b[A-Z]\d{6}\b/gi, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/([\/|,])\s*([\/|,])+/g, "$1")
    .replace(/^\s*[\/|,]\s*|\s*[\/|,]\s*$/g, "")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*\|\s*/g, " / ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isJobCodeToken(value: string) {
  return /^[A-Z]\d{6}$/i.test(value.trim());
}

function uniqueDisplaySegments(values: string[]) {
  const segments = values
    .flatMap((value) => cleanJobLabel(value).split(/[\/|,]/))
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(segments));
}

export async function startInterviewCoaching(args: StartInterviewCoachingArgs) {
  const startedAt = Date.now();
  const traceId = args.traceId || undefined;
  const { job, companyName, positionName, dutyText } = resolveInterviewInput(args);

  if (!companyName && !positionName && !dutyText) {
    throw new Error("지원 공고를 연결하거나 직무명을 입력해 주세요.");
  }

  logInterviewStage(traceId, "service:start", {
    hasUserId: Boolean(args.userId),
    hasAnonymousId: Boolean(args.anonymousId),
    hasPosting: Boolean(args.posting),
    companyName: companyName || "기업 미정",
    positionName: positionName || "직무 미정",
  });
  logInterviewStage(traceId, "db:create-session:start");
  const sessionId = await createInterviewSession({
    userId: args.userId,
    anonymousId: args.anonymousId,
    jobPostingId: args.posting?.id || null,
    jobSnapshot: job,
    companyName: companyName || "기업 미정",
    positionName: positionName || "직무 미정",
    dutyText: dutyText || positionName || "직무 미정",
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });
  logInterviewStage(traceId, "db:create-session:done", {
    sessionId,
    elapsedMs: Date.now() - startedAt,
  });

  const jobContext = args.posting ? buildPostingContext(args.posting) : "";
  const fallbackProfile = {
    companyName: companyName || "기업 미정",
    positionName: positionName || "직무 미정",
    dutyText: dutyText || positionName || "직무 미정",
  };

  try {
    logInterviewStage(traceId, "ai:start-payload:start", {
      sessionId,
      jobContextLength: jobContext.length,
      questionCount: INTERVIEW_QUESTION_COUNT,
    });
    const startInput = {
      ...fallbackProfile,
      jobContext,
    };
    const aiPayload = await requestStartPayload(startInput);
    logInterviewStage(traceId, "ai:start-payload:done", {
      sessionId,
      elapsedMs: Date.now() - startedAt,
    });

    const { analysis, questions } = await normalizeStartPayloadWithAiCompletion(
      aiPayload,
      fallbackProfile,
      startInput,
      traceId,
      sessionId,
    );
    logInterviewStage(traceId, "ai:normalize:done", {
      sessionId,
      ncsMappingCount: analysis.ncsMappings.length,
      questionCount: questions.length,
    });

    logInterviewStage(traceId, "db:update-analysis:start", { sessionId });
    await updateInterviewSessionAnalysis({
      sessionId,
      companyName: analysis.profile.companyName,
      positionName: analysis.profile.positionName,
      dutyText: analysis.profile.dutyText,
      analysis,
      questions,
    });
    logInterviewStage(traceId, "db:update-analysis:done", {
      sessionId,
      elapsedMs: Date.now() - startedAt,
    });

    logInterviewStage(traceId, "db:add-question-messages:start", {
      sessionId,
      questionCount: questions.length,
    });
    for (const question of questions) {
      await addInterviewMessage({
        sessionId,
        questionId: question.id,
        role: "question",
        content: question.question,
      });
    }
    logInterviewStage(traceId, "db:add-question-messages:done", {
      sessionId,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    logInterviewError(traceId, "service:start-failed", error, {
      sessionId,
      elapsedMs: Date.now() - startedAt,
    });
    await markInterviewSessionFailed(
      sessionId,
      error instanceof Error && error.message
        ? error.message
        : "AI NCS 면접 코칭 질문 생성에 실패했습니다.",
    ).catch((markError) => {
      console.error("[InterviewCoaching] failed to mark session failed", markError);
    });
    throw error;
  }

  logInterviewStage(traceId, "db:find-created-session:start", { sessionId });
  const session = await findInterviewSessionForViewer({
    sessionId,
    userId: args.userId,
    anonymousId: args.userId ? null : args.anonymousId,
  });
  if (!session) throw new Error("AI NCS 면접 코칭 세션을 생성하지 못했습니다.");
  logInterviewStage(traceId, "service:done", {
    sessionId,
    elapsedMs: Date.now() - startedAt,
  });
  return session;
}

export async function createInterviewCoachingDraft(args: StartInterviewCoachingArgs) {
  const { job, companyName, positionName, dutyText } = resolveInterviewInput(args);

  if (!companyName && !positionName && !dutyText) {
    throw new Error("지원 공고를 연결하거나 직무명을 입력해 주세요.");
  }

  const sessionId = await createInterviewSession({
    userId: args.userId,
    anonymousId: args.anonymousId,
    jobPostingId: args.posting?.id || null,
    jobSnapshot: job,
    companyName: companyName || "기업 미정",
    positionName: positionName || "직무 미정",
    dutyText: dutyText || positionName || "직무 미정",
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
  });

  const session = await findInterviewSessionForViewer({
    sessionId,
    userId: args.userId,
    anonymousId: args.userId ? null : args.anonymousId,
  });
  if (!session) throw new Error("AI NCS 면접 코칭 세션을 생성하지 못했습니다.");
  return session;
}

export async function generateInterviewCoachingQuestions(args: {
  sessionId: string;
  userId?: string | null;
  anonymousId?: string | null;
}) {
  const draft = await findInterviewSessionForViewer(args);
  if (!draft) throw new Error("AI NCS 면접 코칭 세션을 찾지 못했습니다.");
  if (draft.status === "ready" && draft.questions.length) return draft;

  try {
    const fallbackProfile = {
      companyName: draft.companyName || "기업 미정",
      positionName: draft.positionName || "직무 미정",
      dutyText: draft.dutyText || draft.positionName || "직무 미정",
    };
    const startInput = {
      ...fallbackProfile,
      jobContext: "",
    };
    const { analysis, questions } = await normalizeStartPayloadWithAiCompletion(
      await requestStartPayload(startInput),
      fallbackProfile,
      startInput,
    );

    await updateInterviewSessionAnalysis({
      sessionId: draft.id,
      companyName: analysis.profile.companyName,
      positionName: analysis.profile.positionName,
      dutyText: analysis.profile.dutyText,
      analysis,
      questions,
    });

    for (const question of questions) {
      await addInterviewMessage({
        sessionId: draft.id,
        questionId: question.id,
        role: "question",
        content: question.question,
      });
    }
  } catch (error) {
    await markInterviewSessionFailed(
      draft.id,
      error instanceof Error && error.message
        ? error.message
        : "AI NCS 면접 코칭 질문 생성에 실패했습니다.",
    ).catch((markError) => {
      console.error("[InterviewCoaching] failed to mark session failed", markError);
    });
    throw error;
  }

  const session = await findInterviewSessionForViewer({
    ...args,
    sessionId: draft.id,
  });
  if (!session) throw new Error("면접 질문 생성 후 세션을 찾지 못했습니다.");
  return session;
}

export async function answerInterviewQuestion(args: {
  sessionId: string;
  questionId: string;
  answer: string;
  userId?: string | null;
  anonymousId?: string | null;
}) {
  const session = await findInterviewSessionForViewer(args);
  if (!session) throw new Error("AI NCS 면접 코칭 세션을 찾지 못했습니다.");
  if (session.completedAt) throw new Error("이미 완료된 AI NCS 면접 코칭입니다.");

  const question = session.questions.find((item) => item.id === args.questionId);
  if (!question) throw new Error("면접 질문을 찾지 못했습니다.");

  const answer = cleanText(args.answer).slice(0, 4000);
  if (!answer) throw new Error("답변을 입력해 주세요.");

  const followUpCount = session.messages.filter(
    (item) => item.questionId === question.id && item.role === "follow_up",
  ).length;
  const answerMessage = await addInterviewMessage({
    sessionId: session.id,
    questionId: question.id,
    role: "answer",
    content: answer,
  });

  let feedback: InterviewAnswerFeedback;
  try {
    feedback = normalizeAnswerFeedback(
      await requestAnswerFeedback(session, question, answer, followUpCount),
      followUpCount,
    );

    await updateInterviewMessageFeedback(answerMessage.id, feedback);

    if (feedback.followUpQuestion && followUpCount < MAX_FOLLOW_UPS_PER_QUESTION) {
      await addInterviewMessage({
        sessionId: session.id,
        questionId: question.id,
        role: "follow_up",
        content: feedback.followUpQuestion,
        followUpIndex: followUpCount + 1,
      });
    }
  } catch (error) {
    await markInterviewSessionFailed(
      session.id,
      error instanceof Error && error.message
        ? error.message
        : "AI NCS 면접 코칭 답변 피드백 생성에 실패했습니다.",
    ).catch((markError) => {
      console.error("[InterviewCoaching] failed to mark session failed", markError);
    });
    throw error;
  }

  const updated = await findInterviewSessionForViewer(args);
  if (!updated) throw new Error("면접 답변 저장 후 세션을 찾지 못했습니다.");

  return {
    session: updated,
    feedback,
    followUpQuestion: feedback.followUpQuestion || null,
  };
}

export async function completeInterviewCoaching(args: {
  sessionId: string;
  userId?: string | null;
  anonymousId?: string | null;
}) {
  const session = await findInterviewSessionForViewer(args);
  if (!session) throw new Error("AI NCS 면접 코칭 세션을 찾지 못했습니다.");
  if (!session.messages.some((item) => item.role === "answer")) {
    throw new Error("면접 답변을 하나 이상 제출하면 결과를 확인할 수 있어요.");
  }
  const result = normalizeResult(
    await requestFinalResult(session),
    session.questions,
  );
  await updateInterviewResult(session.id, result);
  const updated = await findInterviewSessionForViewer(args);
  if (!updated) throw new Error("면접 결과 저장 후 세션을 찾지 못했습니다.");
  return updated;
}

export { findInterviewSessionForViewer };

export { listInterviewHistory, claimAnonymousInterviewSessions };

async function requestStartPayload(input: InterviewStartInput) {
  return createOpenAiJsonResponse({
    model: getInterviewModel(),
    schemaName: "interview_coaching_start",
    schema: interviewStartSchema,
    maxOutputTokens: 18000,
    content: [
      {
        type: "input_text",
        text: `한국어 AI NCS 면접 코치입니다.
지원 공고와 직무를 분석해 NCS 7개 후보 중 실제로 연관된 영역만 추출하고, 실제 면접 연습 질문을 생성하세요.
모든 분석과 질문은 기업명, 지원 직무, 공고 내용에서 확인되는 업무/자격/우대사항을 근거로 작성하세요.

기업명: ${input.companyName}
지원 직무: ${input.positionName}
사용자 입력 직무 내용: ${input.dutyText}

공고에서 참고할 내용:
${input.jobContext || "연결된 공고 본문이 없습니다. 기업명과 직무명만 기준으로 분석하세요."}

NCS 7개 후보:
${NCS_AREAS.map((area, index) => `${index + 1}. ${area.name}: ${area.description}`).join("\n")}
ncsMappings에는 위 7개 후보 중 "${input.companyName}"의 "${input.positionName}" 직무 면접에서 실제 평가축으로 직접 사용할 핵심 NCS만 반환하세요.
관련 기준은 "조금이라도 관련 있음"이 아니라 "이 직무 질문을 만들 때 반복적으로 확인해야 하는 핵심 역량"입니다.
공공기관 신입 공통역량, 조직 생활에 일반적으로 필요한 역량, 보조적으로만 관련 있는 영역은 제외하세요.
공고/직무 내용에서 직접 근거를 찾기 어려운 영역은 제외하세요.
ncsMappings는 최소 1개 이상이어야 합니다. 직무 정보가 넓거나 근거가 부족하면 여러 개를 억지로 넣지 말고 가장 가까운 핵심 NCS 1개만 반환하세요.
반환 개수는 AI가 공고의 주요 업무, 자격요건, 우대사항, 전형 정보를 근거로 판단하세요. 보통 핵심 평가축은 적은 수로 좁혀지지만, 서버가 정한 고정 개수는 없습니다.
여러 영역을 반환하려면 각 영역마다 서로 다른 직접 근거가 있어야 합니다. 같은 근거를 여러 NCS에 중복 배정하지 마세요.
각 NCS 영역의 reason에는 "${input.companyName}"와 "${input.positionName}"를 직접 언급하고, 공고/직무의 어떤 구체 문구 또는 업무 때문에 핵심 영역으로 판단했는지 설명하세요.
반환하는 영역의 relevance는 핵심 평가축으로 다룰 만한 관련도가 있을 때만 60~100 사이로 산정하세요.

profile에는 공고 내용을 분석한 값을 반드시 채우세요.
- mainTasks: 공고에서 확인한 주요 업무 2~5개
- requiredKnowledge: 공고 직무 수행에 필요한 지식/기술/자격 2~5개
- preferredExperience: 우대사항 또는 있으면 좋은 경험 1~5개
- keywords: 기업명, 직무명과 중복되지 않는 핵심 키워드 3~8개

questions 배열은 정확히 ${INTERVIEW_QUESTION_COUNT}개를 생성하세요. 경험면접, 상황면접, 직무면접, 인성·가치관, 직업윤리 성격이 골고루 섞여야 합니다.
질문은 실제 면접관이 말하듯 자연스럽게 작성하세요. 모든 문장에 기업명이나 직무명을 반복해서 넣지 말고, 필요할 때만 "우리 기관", "우리 병원", "해당 직무", "현장"처럼 실제 면접에서 쓰는 표현으로 맥락을 녹이세요.
범용 질문처럼 보이지 않도록 공고의 업무, 자격요건, 근무 환경, 평가할 NCS 역량이 질문 상황 안에 자연스럽게 드러나야 합니다.
각 질문의 ncsAreas는 ncsMappings에 반환한 관련 NCS 영역 안에서만 선택하세요. 반환하지 않은 NCS 영역을 질문 태그로 붙이지 마세요.
반드시 JSON 객체 하나만 반환하고, 모든 문장은 한국어로 작성하세요.`,
      },
    ],
  });
}

async function requestStartSupplementPayload(
  input: InterviewStartInput,
  partial: ReturnType<typeof normalizeStartPayload>,
) {
  return createOpenAiJsonResponse({
    model: getInterviewModel(),
    schemaName: "interview_coaching_start_supplement",
    schema: interviewStartSchema,
    maxOutputTokens: 18000,
    content: [
      {
        type: "input_text",
        text: `한국어 AI NCS 면접 코치입니다.
앞선 AI 응답에서 NCS 매핑 또는 면접 질문 수가 부족했습니다.
서버에서 임의 질문을 만들지 않도록, 아래 공고/직무 정보를 다시 분석해 최종 사용 가능한 JSON을 완성하세요.

기업명: ${input.companyName}
지원 직무: ${input.positionName}
사용자 입력 직무 내용: ${input.dutyText}

공고에서 참고할 내용:
${input.jobContext || "연결된 공고 본문이 없습니다. 기업명과 직무명만 기준으로 분석하세요."}

NCS 7개 후보:
${NCS_AREAS.map((area, index) => `${index + 1}. ${area.name}: ${area.description}`).join("\n")}

현재 확보된 NCS 매핑:
${partial.analysis.ncsMappings.map((item) => `- ${item.name} ${item.relevance}%: ${item.reason}`).join("\n") || "- 없음"}

현재 확보된 질문:
${partial.questions.map((item, index) => `${index + 1}. ${item.question} (${item.ncsAreas.join(", ")})`).join("\n") || "- 없음"}

요구사항:
- profile.mainTasks, profile.requiredKnowledge, profile.preferredExperience, profile.keywords는 공고와 직무를 분석해 빈 배열 없이 채우세요.
- ncsMappings에는 위 7개 후보 중 "${input.companyName}"의 "${input.positionName}" 직무 면접에서 실제 평가축으로 직접 사용할 핵심 NCS만 넣으세요.
- ncsMappings는 최소 1개 이상이어야 합니다.
- 직무 정보가 넓거나 근거가 부족하면 여러 개를 억지로 넣지 말고 가장 가까운 핵심 NCS 1개만 반환하세요.
- 반환 개수는 AI가 공고와 직무의 직접 근거를 보고 판단하세요. 서버가 정한 고정 개수는 없습니다.
- 여러 영역을 반환하려면 각 영역마다 서로 다른 직접 근거가 있어야 합니다. 같은 근거를 여러 NCS에 중복 배정하지 마세요.
- questions는 정확히 ${INTERVIEW_QUESTION_COUNT}개를 반환하세요.
- 기존 질문과 의미가 겹치지 않게, 부족한 질문은 AI가 공고/직무/NCS 매핑을 기준으로 새로 생성하세요.
- 질문은 실제 면접관이 말하듯 자연스럽게 작성하세요. 기업명과 직무명을 매번 문장에 억지로 넣지 말고, 필요할 때만 "우리 기관", "우리 병원", "해당 직무", "현장"처럼 자연스러운 표현으로 맥락을 녹이세요.
- 각 질문의 ncsAreas는 ncsMappings에 포함된 NCS 영역 안에서만 선택하세요.
- profile, ncsMappings, questionPlan, questions를 모두 포함한 JSON 객체 하나만 반환하세요.
- 모든 문장은 한국어로 작성하세요.`,
      },
    ],
  });
}

async function requestAnswerFeedback(
  session: Awaited<ReturnType<typeof findInterviewSessionForViewer>>,
  question: InterviewQuestion,
  answer: string,
  followUpCount: number,
) {
  if (!session) throw new Error("AI NCS 면접 코칭 세션을 찾지 못했습니다.");
  const questionMessages = session.messages.filter((item) => item.questionId === question.id);
  const latestMessage = [...questionMessages].reverse().find(
    (item) => item.role === "answer" || item.role === "follow_up",
  );
  const currentPrompt = latestMessage?.role === "follow_up" ? latestMessage.content : question.question;
  const currentPromptLabel = latestMessage?.role === "follow_up"
    ? `꼬리질문 ${latestMessage.followUpIndex || followUpCount}`
    : "원 질문";

  return createOpenAiJsonResponse({
    model: getInterviewModel(),
    schemaName: "interview_answer_feedback",
    schema: answerFeedbackSchema,
    maxOutputTokens: 4500,
    content: [
      {
        type: "input_text",
        text: `한국어 AI 면접관입니다. 지원자의 답변을 평가하고 필요한 경우 꼬리질문을 1개 생성하세요.
한 문항당 꼬리질문은 최대 ${MAX_FOLLOW_UPS_PER_QUESTION}개입니다. 이미 나온 꼬리질문 수는 ${followUpCount}개입니다.
이미 ${MAX_FOLLOW_UPS_PER_QUESTION}개가 나왔다면 followUpQuestion은 null로 반환하세요.

기업/직무: ${session.companyName} / ${session.positionName}
NCS 매핑: ${session.analysis.ncsMappings.map((item) => `${item.name} ${item.relevance}%`).join(", ")}
NCS 7개 후보: ${NCS_AREAS.map((area) => area.name).join(", ")}
원 질문: ${question.question}
질문 의도: ${question.intent}
관련 NCS: ${question.ncsAreas.join(", ")}
이번 답변 대상: ${currentPromptLabel}
이번에 지원자가 답해야 하는 면접관 질문: ${currentPrompt}

이전 대화:
${questionMessages.map((item) => `${item.role}${item.followUpIndex ? ` ${item.followUpIndex}` : ""}: ${item.content}`).join("\n")}

이번 답변:
${answer}

정답/오답 판정이 아니라 면접 답변 코칭 관점으로 설명하세요.
피드백은 반드시 "이번에 지원자가 답해야 하는 면접관 질문"에 대한 이번 답변 기준으로 작성하세요. 꼬리질문 답변을 평가할 때 원 질문만 기준으로 되돌아가 평가하지 마세요.
꼬리질문은 원 질문의 관련 NCS(${question.ncsAreas.join(", ")})에만 고정하지 말고, NCS 7개 후보 중 지원자의 이번 답변과 ${session.companyName}의 ${session.positionName} 직무 면접 흐름에 자연스럽게 이어지는 영역을 AI가 판단해 생성하세요.
같은 문항 안에서도 꼬리질문이 계속 같은 NCS만 반복되지 않도록 하되, 갑자기 무관한 직무, 산업, 상황으로 넘어가지 마세요.
꼬리질문은 지원자의 이번 답변에서 빠진 상황, 본인 역할, 판단 근거, 행동, 결과 중 하나를 구체적으로 묻는 문장이어야 합니다.
followUpQuestion은 실제 면접관이 지원자의 답변을 듣고 바로 이어 묻는 말투로 작성하세요. 기업명/직무명을 억지로 반복하지 말고, 필요할 때만 "우리 기관", "우리 병원", "해당 직무", "현장"처럼 자연스럽게 말하세요.
반드시 JSON 객체 하나만 반환하세요.`,
      },
    ],
  });
}

async function requestFinalResult(
  session: Awaited<ReturnType<typeof findInterviewSessionForViewer>>,
) {
  if (!session) throw new Error("AI NCS 면접 코칭 세션을 찾지 못했습니다.");
  const answeredQuestionIds = new Set(
    session.messages.filter((item) => item.role === "answer").map((item) => item.questionId),
  );
  return createOpenAiJsonResponse({
    model: getInterviewModel(),
    schemaName: "interview_coaching_result",
    schema: finalResultSchema,
    maxOutputTokens: 18000,
    content: [
      {
        type: "input_text",
        text: `한국어 AI NCS 면접 코치입니다. 면접 연습 전체를 종합해 최종 결과를 작성하세요.

기업/직무: ${session.companyName} / ${session.positionName}
NCS 매핑: ${session.analysis.ncsMappings.map((item) => `${item.name} ${item.relevance}% - ${item.reason}`).join("\n")}
질문 목록:
${session.questions.map((item, index) => `${index + 1}. ${item.question}`).join("\n")}

대화 기록:
${session.messages.map((item) => `${item.role}${item.followUpIndex ? ` ${item.followUpIndex}` : ""}: ${item.content}`).join("\n")}

답변한 문항 수: ${answeredQuestionIds.size}개
최종 평가는 답변이 제출된 문항과 그 꼬리질문 기록을 중심으로 작성하세요. 답변하지 않은 문항은 평가하지 말고, 필요하면 추가 연습 권장 문항으로만 다루세요.
점수는 공식 NCS 점수가 아니라 서비스용 참고 점수입니다.
반드시 JSON 객체 하나만 반환하세요.`,
      },
    ],
  });
}

function getInterviewModel() {
  return getOpenAiModel(
    process.env.OPENAI_INTERVIEW_COACHING_MODEL ||
      process.env.OPENAI_COACHING_MODEL ||
      process.env.GPT_COACHING_MODEL,
  );
}

function makeJobSnapshot(posting: JobPostingDetailRow): InterviewCoachingJobDto {
  return {
    id: posting.id,
    institutionName: posting.institution_name,
    title: posting.title,
    applicationEndAt: posting.application_end_at
      ? new Date(posting.application_end_at).toISOString()
      : null,
  };
}

function buildPostingContext(posting: JobPostingDetailRow) {
  const categoryLabels = Array.from(new Set([
    cleanJobLabel(posting.ncs_category),
    cleanJobLabel(posting.job_category),
    ...(posting.categories || []).map(cleanJobLabel),
  ].filter(Boolean)));

  return [
    `공고명: ${removeJobCodesFromText(posting.title) || posting.title}`,
    `기관명: ${posting.institution_name}`,
    `NCS/직무 분류: ${categoryLabels.join(" / ") || "-"}`,
    `기본 정보: ${posting.basic_info || "-"}`,
    `지원 자격: ${posting.qualification || "-"}`,
    `우대사항: ${posting.preference_condition || posting.preference || "-"}`,
    `전형 절차: ${posting.screening_process || "-"}`,
    `제출 서류: ${posting.required_documents || "-"}`,
    `추가 안내: ${posting.additional_notice || "-"}`,
  ].join("\n").slice(0, 8000);
}

async function normalizeStartPayloadWithAiCompletion(
  value: unknown,
  fallback: { companyName: string; positionName: string; dutyText: string },
  input: InterviewStartInput,
  traceId?: string,
  sessionId?: string,
) {
  let normalized = normalizeStartPayload(value, fallback);
  if (isStartPayloadComplete(normalized)) return normalized;

  for (let attempt = 1; attempt <= 2 && !isStartPayloadComplete(normalized); attempt += 1) {
    logInterviewStage(traceId, "ai:start-supplement:start", {
      sessionId,
      attempt,
      ncsMappingCount: normalized.analysis.ncsMappings.length,
      questionCount: normalized.questions.length,
    });
    const supplementPayload = await requestStartSupplementPayload(input, normalized);
    const supplemented = normalizeStartPayload(supplementPayload, fallback);
    normalized = mergeStartPayloads(normalized, supplemented);
    logInterviewStage(traceId, "ai:start-supplement:done", {
      sessionId,
      attempt,
      ncsMappingCount: normalized.analysis.ncsMappings.length,
      questionCount: normalized.questions.length,
    });
  }

  return normalized;
}

function isStartPayloadComplete(value: ReturnType<typeof normalizeStartPayload>) {
  const profile = value.analysis.profile;
  return (
    value.analysis.ncsMappings.length > 0 &&
    value.questions.length >= INTERVIEW_QUESTION_COUNT &&
    profile.mainTasks.length > 0 &&
    profile.requiredKnowledge.length > 0 &&
    profile.keywords.length > 0
  );
}

function mergeStartPayloads(
  current: ReturnType<typeof normalizeStartPayload>,
  supplemented: ReturnType<typeof normalizeStartPayload>,
) {
  const analysis = {
    profile: hasProfileDetails(supplemented.analysis.profile)
      ? supplemented.analysis.profile
      : current.analysis.profile,
    ncsMappings: supplemented.analysis.ncsMappings.length
      ? supplemented.analysis.ncsMappings
      : current.analysis.ncsMappings,
    questionPlan: supplemented.analysis.questionPlan.length
      ? supplemented.analysis.questionPlan
      : current.analysis.questionPlan,
  };

  return {
    analysis,
    questions: mergeAiQuestions(
      current.questions,
      supplemented.questions,
      analysis.ncsMappings,
    ),
  };
}

function hasProfileDetails(profile: InterviewAnalysis["profile"]) {
  return Boolean(
    profile.mainTasks.length ||
      profile.requiredKnowledge.length ||
      profile.preferredExperience.length ||
      profile.keywords.length,
  );
}

function normalizeStartPayload(
  value: unknown,
  fallback: { companyName: string; positionName: string; dutyText: string },
) {
  const record = asRecord(value);
  const profileRecord =
    asRecord(record?.profile) ||
    asRecord(record?.jobProfile) ||
    asRecord(record?.positionProfile) ||
    asRecord(record?.analysis);
  const profile = {
    companyName:
      removeJobCodesFromText(readString(profileRecord?.companyName)) || fallback.companyName,
    positionName:
      cleanJobLabel(readString(profileRecord?.positionName)) || fallback.positionName,
    dutyText: removeJobCodesFromText(readString(profileRecord?.dutyText)) || fallback.dutyText,
    mainTasks: uniqueDisplayList(readFirstDisplayStringList(profileRecord, [
      "mainTasks",
      "tasks",
      "coreTasks",
      "coreDuties",
      "duties",
      "jobDuties",
      "responsibilities",
    ]), 5),
    requiredKnowledge: uniqueDisplayList(readFirstDisplayStringList(profileRecord, [
      "requiredKnowledge",
      "knowledge",
      "requiredSkills",
      "skills",
      "qualifications",
      "requirements",
      "requiredCompetencies",
    ]), 5),
    preferredExperience: uniqueDisplayList(readFirstDisplayStringList(profileRecord, [
      "preferredExperience",
      "experiences",
      "experience",
      "preferredQualifications",
      "preferredSkills",
      "preferences",
      "preferred",
    ]), 5),
    keywords: uniqueDisplayList(readFirstDisplayStringList(profileRecord, [
      "keywords",
      "keyWords",
      "coreKeywords",
      "jobKeywords",
      "tags",
    ]), 8),
  };
  profile.keywords = compactProfileKeywords(profile.keywords, [
    profile.companyName,
    profile.positionName,
    profile.dutyText,
  ]);

  const providedMappings = normalizeArray(record?.ncsMappings)
    .map((item) => normalizeMapping(item, profile))
    .filter(Boolean) as InterviewAnalysis["ncsMappings"];
  const ncsMappings = uniqueNcsMappings(providedMappings);
  const questionMappings = getQuestionNcsMappings(ncsMappings);

  const questions = normalizeArray(record?.questions)
    .map((item, index) => normalizeQuestion(item, index, questionMappings, profile))
    .filter(Boolean) as InterviewQuestion[];

  const questionPlan = readStringList(record?.questionPlan).slice(0, INTERVIEW_QUESTION_COUNT);

  return {
    analysis: {
      profile,
      ncsMappings,
      questionPlan: questionPlan.length
        ? questionPlan
        : questions.map((item) => item.intent),
    },
    questions: mergeAiQuestions([], questions, questionMappings),
  };
}

function getQuestionNcsMappings(mappings: InterviewAnalysis["ncsMappings"]) {
  return [...mappings].sort((left, right) => right.relevance - left.relevance);
}

function normalizeMapping(value: unknown, profile: InterviewAnalysis["profile"]) {
  const record = asRecord(value);
  const name = normalizeNcsAreaName(record?.name);
  if (!record || !name) return null;
  const area = NCS_AREAS.find((item) => item.name === name);
  const relevance = clampNumber(record.relevance, 0, 100, 60);
  const reason = readString(record.reason);
  return {
    name,
    relevance,
    reason:
      contextualizeMappingReason(removeJobCodesFromText(reason), profile, area?.description || name),
    interviewFocus:
      removeJobCodesFromText(readString(record.interviewFocus)) ||
      `${profile.companyName} ${profile.positionName} 면접에서 확인할 ${area?.description || name}`,
  };
}

function contextualizeMappingReason(
  reason: string,
  profile: InterviewAnalysis["profile"],
  fallbackFocus: string,
) {
  if (!reason) {
    return `${profile.companyName}의 ${profile.positionName} 직무에서 ${fallbackFocus}을 확인하기 위해 매핑했습니다.`;
  }
  if (reason.includes(profile.companyName) || reason.includes(profile.positionName)) {
    return reason;
  }
  return `${profile.companyName}의 ${profile.positionName} 직무 기준으로, ${reason}`;
}

function uniqueDisplayList(items: string[], limit: number) {
  return Array.from(new Set(
    items.map((item) => removeJobCodesFromText(item)).filter(Boolean),
  )).slice(0, limit);
}

function uniqueNcsMappings(mappings: InterviewAnalysis["ncsMappings"]) {
  const byName = new Map<NcsAreaName, InterviewAnalysis["ncsMappings"][number]>();
  for (const mapping of mappings) {
    const previous = byName.get(mapping.name);
    if (!previous || mapping.relevance > previous.relevance) {
      byName.set(mapping.name, mapping);
    }
  }
  return Array.from(byName.values())
    .sort((left, right) => right.relevance - left.relevance);
}

function compactProfileKeywords(items: string[], hiddenContexts: string[]) {
  const cleaned = Array.from(new Set(
    items
      .flatMap((item) => removeJobCodesFromText(item).split(/[\/|,]/))
      .map((item) => item.trim())
      .filter(Boolean),
  ));
  const exactHidden = hiddenContexts.map(removeJobCodesFromText);
  const contextText = exactHidden.join(" ");

  return cleaned.filter((item) => {
    if (item.length < 2) return false;
    if (exactHidden.includes(item)) return false;
    const tokenPattern = new RegExp(`(^|[\\s./·()])${escapeRegExp(item)}($|[\\s./·()])`);
    const coveredByLongerKeyword = cleaned.some(
      (other) => other !== item && other.length > item.length && tokenPattern.test(other),
    );
    return !coveredByLongerKeyword && !tokenPattern.test(contextText);
  }).slice(0, 8);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuestion(
  value: unknown,
  index: number,
  mappings: InterviewAnalysis["ncsMappings"],
  profile: InterviewAnalysis["profile"],
) {
  const record = asRecord(value);
  if (!record) return null;
  const question = removeJobCodesFromText(readFirstString(record, [
    "question",
    "prompt",
    "content",
    "text",
  ]));
  if (!question) return null;
  const areas = readFirstStringList(record, [
    "ncsAreas",
    "ncsAreaNames",
    "ncsCompetencies",
    "competencies",
    "areas",
  ])
    .map(normalizeNcsAreaName)
    .filter(Boolean) as NcsAreaName[];
  const allowedAreas = constrainQuestionAreas(areas, mappings, index);
  return {
    id: readString(record.id) || `q${index + 1}`,
    type: normalizeQuestionType(record.type, index),
    question,
    intent:
      removeJobCodesFromText(readString(record.intent)) ||
      `${profile.companyName} ${profile.positionName} 직무와 NCS 역량을 확인합니다.`,
    ncsAreas: allowedAreas,
    difficulty: readString(record.difficulty) === "심화" ? "심화" : "기본",
  };
}

function constrainQuestionAreas(
  areas: NcsAreaName[],
  mappings: InterviewAnalysis["ncsMappings"],
  index: number,
) {
  const allowed = new Set(mappings.map((item) => item.name));
  const filtered = areas.filter((area) => allowed.has(area));
  const fallback = mappings[index % Math.max(mappings.length, 1)]?.name;
  return (filtered.length ? filtered : fallback ? [fallback] : []).slice(0, 2);
}

function mergeAiQuestions(
  currentQuestions: InterviewQuestion[],
  nextQuestions: InterviewQuestion[],
  mappings: InterviewAnalysis["ncsMappings"],
) {
  const seen = new Set<string>();
  const merged = [...currentQuestions, ...nextQuestions]
    .filter((item) => {
      const key = item.question.replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, INTERVIEW_QUESTION_COUNT);

  return merged.map((item, index) => ({
    ...item,
    id: `q${index + 1}`,
    ncsAreas: constrainQuestionAreas(item.ncsAreas, mappings, index),
  }));
}

function normalizeAnswerFeedback(
  value: unknown,
  followUpCount: number,
): InterviewAnswerFeedback {
  const record = asRecord(value);
  const followUpQuestion =
    followUpCount >= MAX_FOLLOW_UPS_PER_QUESTION
      ? null
      : removeJobCodesFromText(readString(record?.followUpQuestion).slice(0, 240)) || null;
  return {
    summary: removeJobCodesFromText(readString(record?.summary)),
    strengths: uniqueDisplayList(readDisplayStringList(record?.strengths), 4),
    improvements: uniqueDisplayList(readDisplayStringList(record?.improvements), 4),
    nextAnswerGuide: removeJobCodesFromText(readString(record?.nextAnswerGuide)),
    followUpQuestion,
  };
}

function normalizeResult(
  value: unknown,
  questions: InterviewQuestion[],
): InterviewCoachingResult {
  const record = asRecord(value);
  const reviews = normalizeArray(record?.questionReviews)
    .map((item, index) => normalizeQuestionReview(item, questions[index]))
    .filter(Boolean) as InterviewCoachingResult["questionReviews"];

  return {
    score: clampNumber(record?.score, 0, 100, 72),
    summary: removeJobCodesFromText(readString(record?.summary)),
    strengths: uniqueDisplayList(readDisplayStringList(record?.strengths), 4),
    improvements: uniqueDisplayList(readDisplayStringList(record?.improvements), 4),
    questionReviews: reviews,
    futurePracticeQuestions: uniqueDisplayList(
      readDisplayStringList(record?.futurePracticeQuestions),
      5,
    ),
  };
}

function normalizeQuestionReview(value: unknown, fallback?: InterviewQuestion) {
  const record = asRecord(value);
  if (!record && !fallback) return null;
  const questionId = readString(record?.questionId) || fallback?.id || "q1";
  const question = removeJobCodesFromText(readString(record?.question)) || fallback?.question || "면접 질문";
  const areas = readStringList(record?.ncsAreas)
    .map(normalizeNcsAreaName)
    .filter(Boolean) as NcsAreaName[];
  return {
    questionId,
    question,
    score: clampNumber(record?.score, 0, 100, 70),
    summary: removeJobCodesFromText(readString(record?.summary)),
    strengths: uniqueDisplayList(readDisplayStringList(record?.strengths), 4),
    improvements: uniqueDisplayList(readDisplayStringList(record?.improvements), 4),
    ncsAreas: areas.length ? areas : fallback?.ncsAreas || [],
  };
}

function normalizeQuestionType(value: unknown, index: number): InterviewQuestion["type"] {
  const text = readString(value);
  if (["experience", "situation", "job", "personality", "ethics"].includes(text)) {
    return text as InterviewQuestion["type"];
  }
  return (["experience", "situation", "job", "personality", "ethics"] as const)[index % 5];
}

function normalizeNcsAreaName(value: unknown): NcsAreaName | null {
  const text = readString(value).replace(/\s/g, "");
  return NCS_AREAS.find((area) => area.name.replace(/\s/g, "") === text)?.name || null;
}

function readStringList(value: unknown) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return normalizeArray(value).map(readString).filter(Boolean);
}

function readDisplayStringList(value: unknown) {
  return readStringList(value).map(removeJobCodesFromText).filter(Boolean);
}

function readFirstString(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  if (!record) return "";
  for (const key of keys) {
    const value = readString(record[key]);
    if (value) return value;
  }
  return "";
}

function readFirstStringList(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  if (!record) return [];
  for (const key of keys) {
    const value = readStringList(record[key]);
    if (value.length) return value;
  }
  return [];
}

function readFirstDisplayStringList(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  return readFirstStringList(record, keys).map(removeJobCodesFromText).filter(Boolean);
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function readString(value: unknown) {
  return typeof value === "string" ? cleanText(value) : "";
}

function logInterviewStage(
  traceId: string | undefined,
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!traceId) return;
  console.info(`[InterviewCoaching:${traceId}] ${stage}`, details || {});
}

function logInterviewError(
  traceId: string | undefined,
  stage: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  if (!traceId) return;
  console.error(`[InterviewCoaching:${traceId}] ${stage}`, {
    ...details,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function cleanText(value?: string | null) {
  return (value || "").replace(/\r/g, "").replace(/\n{4,}/g, "\n\n").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const interviewStartSchema = {
  type: "object",
  additionalProperties: true,
  required: ["profile", "ncsMappings", "questions"],
  properties: {
    profile: {
      type: "object",
      additionalProperties: true,
      required: [
        "companyName",
        "positionName",
        "dutyText",
        "mainTasks",
        "requiredKnowledge",
        "preferredExperience",
        "keywords",
      ],
      properties: {
        companyName: { type: "string" },
        positionName: { type: "string" },
        dutyText: { type: "string" },
        mainTasks: { type: "array", minItems: 1, items: { type: "string" } },
        requiredKnowledge: { type: "array", minItems: 1, items: { type: "string" } },
        preferredExperience: { type: "array", items: { type: "string" } },
        keywords: { type: "array", minItems: 1, items: { type: "string" } },
      },
    },
    ncsMappings: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: true,
        required: ["name", "relevance", "reason", "interviewFocus"],
        properties: {
          name: {
            type: "string",
            enum: NCS_AREAS.map((area) => area.name),
          },
          relevance: { type: "number", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          interviewFocus: { type: "string" },
        },
      },
    },
    questionPlan: { type: "array", items: { type: "string" } },
    questions: {
      type: "array",
      minItems: INTERVIEW_QUESTION_COUNT,
      maxItems: INTERVIEW_QUESTION_COUNT,
      items: {
        type: "object",
        additionalProperties: true,
        required: ["id", "type", "question", "intent", "ncsAreas", "difficulty"],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["experience", "situation", "job", "personality", "ethics"],
          },
          question: { type: "string" },
          intent: { type: "string" },
          ncsAreas: {
            type: "array",
            minItems: 1,
            items: {
              type: "string",
              enum: NCS_AREAS.map((area) => area.name),
            },
          },
          difficulty: { type: "string", enum: ["기본", "심화"] },
        },
      },
    },
  },
} as const;

const answerFeedbackSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    nextAnswerGuide: { type: "string" },
    followUpQuestion: { type: ["string", "null"] },
  },
} as const;

const finalResultSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    score: { type: "number" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    questionReviews: { type: "array", items: { type: "object", additionalProperties: true } },
    futurePracticeQuestions: { type: "array", items: { type: "string" } },
  },
} as const;
