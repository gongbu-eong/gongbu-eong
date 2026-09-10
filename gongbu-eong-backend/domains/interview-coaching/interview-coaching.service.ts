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
const RELEVANT_NCS_THRESHOLD = 50;

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
      postingJobCategory,
      postingNcsCategory,
      ...postingCategories,
      removeJobCodesFromText(args.posting.title),
    ].map((item) => item.slice(0, 120)).find(Boolean) || ""
    : "";
  const postingDutyText = args.posting
    ? Array.from(new Set([
      postingJobCategory,
      postingNcsCategory,
      ...postingCategories,
      meaningfulDutyText,
    ].filter(Boolean))).join(" / ").slice(0, 400)
    : "";

  return {
    job,
    companyName: job?.institutionName || manualCompanyName,
    positionName: args.posting
      ? postingPositionName || manualPositionName || meaningfulDutyText
      : meaningfulDutyText || manualPositionName,
    dutyText: args.posting
      ? postingDutyText || postingPositionName || manualPositionName || meaningfulDutyText
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
    const aiPayload = await requestStartPayload({
      ...fallbackProfile,
      jobContext,
    });
    logInterviewStage(traceId, "ai:start-payload:done", {
      sessionId,
      elapsedMs: Date.now() - startedAt,
    });

    const { analysis, questions } = normalizeStartPayload(
      aiPayload,
      fallbackProfile,
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
        : "AI 면접 코칭 질문 생성에 실패했습니다.",
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
  if (!session) throw new Error("면접 코칭 세션을 생성하지 못했습니다.");
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
  if (!session) throw new Error("면접 코칭 세션을 생성하지 못했습니다.");
  return session;
}

export async function generateInterviewCoachingQuestions(args: {
  sessionId: string;
  userId?: string | null;
  anonymousId?: string | null;
}) {
  const draft = await findInterviewSessionForViewer(args);
  if (!draft) throw new Error("면접 코칭 세션을 찾지 못했습니다.");
  if (draft.status === "ready" && draft.questions.length) return draft;

  try {
    const { analysis, questions } = normalizeStartPayload(
      await requestStartPayload({
        companyName: draft.companyName || "기업 미정",
        positionName: draft.positionName || "직무 미정",
        dutyText: draft.dutyText || draft.positionName || "직무 미정",
        jobContext: "",
      }),
      {
        companyName: draft.companyName || "기업 미정",
        positionName: draft.positionName || "직무 미정",
        dutyText: draft.dutyText || draft.positionName || "직무 미정",
      },
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
        : "AI 면접 코칭 질문 생성에 실패했습니다.",
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
  if (!session) throw new Error("면접 코칭 세션을 찾지 못했습니다.");
  if (session.completedAt) throw new Error("이미 완료된 면접 코칭입니다.");

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
      session,
      question,
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
        : "AI 면접 답변 코칭에 실패했습니다.",
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
  if (!session) throw new Error("면접 코칭 세션을 찾지 못했습니다.");
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

async function requestStartPayload(input: {
  companyName: string;
  positionName: string;
  dutyText: string;
  jobContext: string;
}) {
  return createOpenAiJsonResponse({
    model: getInterviewModel(),
    schemaName: "interview_coaching_start",
    schema: interviewStartSchema,
    maxOutputTokens: 18000,
    content: [
      {
        type: "input_text",
        text: `한국어 NCS 직무 기반 AI 면접 코치입니다.
지원 공고와 직무를 분석해 NCS 7개 후보 중 실제로 연관된 영역만 추출하고, 실제 면접 연습 질문을 생성하세요.
모든 분석과 질문은 기업명, 지원 직무, 공고 내용에서 확인되는 업무/자격/우대사항을 근거로 작성하세요.

기업명: ${input.companyName}
지원 직무: ${input.positionName}
사용자 입력 직무 내용: ${input.dutyText}

공고에서 참고할 내용:
${input.jobContext || "연결된 공고 본문이 없습니다. 기업명과 직무명만 기준으로 분석하세요."}

NCS 7개 후보:
${NCS_AREAS.map((area, index) => `${index + 1}. ${area.name}: ${area.description}`).join("\n")}
ncsMappings에는 위 7개 후보 중 "${input.companyName}"의 "${input.positionName}" 직무와 실제로 관련 있는 영역만 반환하세요.
관련성이 약하거나 공고/직무 내용에서 근거를 찾기 어려운 영역은 ncsMappings에 넣지 마세요.
반환 개수 제한은 없습니다. 2개만 관련 있으면 2개만, 6개가 관련 있으면 6개를 반환하세요.
각 NCS 영역의 reason에는 "${input.companyName}"와 "${input.positionName}"를 직접 언급하고, 공고/직무의 어떤 내용 때문에 관련 영역으로 판단했는지 설명하세요.
반환하는 영역의 relevance는 면접 질문으로 다룰 만한 관련도가 있을 때만 50~100 사이로 산정하세요.

질문은 ${INTERVIEW_QUESTION_COUNT}개를 생성하세요. 경험면접, 상황면접, 직무면접, 인성·가치관, 직업윤리 성격이 골고루 섞여야 합니다.
각 질문은 "${input.companyName}" 또는 "${input.positionName}" 또는 직무 핵심 키워드 중 하나 이상을 자연스럽게 포함해, 범용 질문처럼 보이지 않게 작성하세요.
각 질문의 ncsAreas는 ncsMappings에 반환한 관련 NCS 영역 안에서만 선택하세요. 반환하지 않은 NCS 영역을 질문 태그로 붙이지 마세요.
반드시 JSON 객체 하나만 반환하고, 모든 문장은 한국어로 작성하세요.`,
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
  if (!session) throw new Error("면접 코칭 세션을 찾지 못했습니다.");
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
현재 질문: ${question.question}
질문 의도: ${question.intent}
관련 NCS: ${question.ncsAreas.join(", ")}

이전 대화:
${session.messages.filter((item) => item.questionId === question.id).map((item) => `${item.role}: ${item.content}`).join("\n")}

이번 답변:
${answer}

정답/오답 판정이 아니라 면접 답변 코칭 관점으로 설명하세요.
꼬리질문은 반드시 현재 질문의 관련 NCS(${question.ncsAreas.join(", ")})와 ${session.companyName}의 ${session.positionName} 직무 맥락 안에서 이어져야 합니다.
갑자기 다른 NCS 영역, 다른 직무, 다른 산업의 질문으로 넘어가지 마세요.
꼬리질문은 지원자의 이번 답변에서 빠진 상황, 본인 역할, 판단 근거, 행동, 결과 중 하나를 구체적으로 묻는 문장이어야 합니다.
followUpQuestion 문장 안에는 가능한 한 "${session.companyName}", "${session.positionName}", 또는 현재 질문의 핵심 표현 중 하나를 자연스럽게 포함하세요.
반드시 JSON 객체 하나만 반환하세요.`,
      },
    ],
  });
}

async function requestFinalResult(
  session: Awaited<ReturnType<typeof findInterviewSessionForViewer>>,
) {
  if (!session) throw new Error("면접 코칭 세션을 찾지 못했습니다.");
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
        text: `한국어 NCS 직무 기반 AI 면접 코치입니다. 면접 연습 전체를 종합해 최종 결과를 작성하세요.

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

function normalizeStartPayload(
  value: unknown,
  fallback: { companyName: string; positionName: string; dutyText: string },
) {
  const record = asRecord(value);
  const profileRecord = asRecord(record?.profile);
  const fallbackProfile = buildFallbackProfile(fallback);
  const profile = {
    companyName:
      removeJobCodesFromText(readString(profileRecord?.companyName)) || fallback.companyName,
    positionName:
      cleanJobLabel(readString(profileRecord?.positionName)) || fallback.positionName,
    dutyText: removeJobCodesFromText(readString(profileRecord?.dutyText)) || fallback.dutyText,
    mainTasks: withFallbackList(
      readDisplayStringList(profileRecord?.mainTasks),
      fallbackProfile.mainTasks,
      5,
    ),
    requiredKnowledge: withFallbackList(
      readDisplayStringList(profileRecord?.requiredKnowledge),
      fallbackProfile.requiredKnowledge,
      5,
    ),
    preferredExperience: withFallbackList(
      readDisplayStringList(profileRecord?.preferredExperience),
      fallbackProfile.preferredExperience,
      5,
    ),
    keywords: withFallbackList(
      readDisplayStringList(profileRecord?.keywords),
      fallbackProfile.keywords,
      8,
    ),
  };

  const providedMappings = normalizeArray(record?.ncsMappings)
    .map((item) => normalizeMapping(item, profile))
    .filter(Boolean) as InterviewAnalysis["ncsMappings"];
  const relevantProvidedMappings = providedMappings.filter(
    (item) => item.relevance >= RELEVANT_NCS_THRESHOLD,
  );
  const ncsMappings = relevantProvidedMappings.length
    ? relevantProvidedMappings
    : buildFallbackNcsMappings(profile);
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
    questions: fillQuestions(questions, questionMappings, profile),
  };
}

function getQuestionNcsMappings(mappings: InterviewAnalysis["ncsMappings"]) {
  const sorted = [...mappings].sort((left, right) => right.relevance - left.relevance);
  const matched = sorted.filter((item) => item.relevance >= RELEVANT_NCS_THRESHOLD);
  return matched.length ? matched : sorted.slice(0, 1);
}

function buildFallbackNcsMappings(profile: InterviewAnalysis["profile"]) {
  const scored = NCS_AREAS
    .map((area) => ({
      area,
      relevance: scoreNcsArea(area.name, profile),
    }))
    .sort((left, right) => right.relevance - left.relevance);
  const matched = scored.filter((item) => item.relevance >= RELEVANT_NCS_THRESHOLD);
  return (matched.length ? matched : scored.slice(0, 1)).map(({ area, relevance }) => ({
    name: area.name,
    relevance,
    reason: `${profile.companyName}의 ${profile.positionName} 직무에서 ${area.description}을 확인할 필요가 있어 매핑했습니다.`,
    interviewFocus: `${profile.companyName} ${profile.positionName} 지원자가 면접에서 설명해야 할 ${area.description}`,
  }));
}

function normalizeMapping(value: unknown, profile: InterviewAnalysis["profile"]) {
  const record = asRecord(value);
  const name = normalizeNcsAreaName(record?.name);
  if (!record || !name) return null;
  const area = NCS_AREAS.find((item) => item.name === name);
  const relevance = clampNumber(record.relevance, 0, 100, scoreNcsArea(name, profile));
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

function scoreNcsArea(
  name: NcsAreaName,
  profile: InterviewAnalysis["profile"],
) {
  const text = [
    profile.companyName,
    profile.positionName,
    profile.dutyText,
    ...profile.keywords,
  ].join(" ").toLowerCase();
  const keywordMap: Record<NcsAreaName, string[]> = {
    의사소통능력: [
      "문서",
      "작성",
      "보고",
      "설명",
      "민원",
      "고객",
      "상담",
      "홍보",
      "행정",
      "사무",
      "협의",
      "커뮤니케이션",
    ],
    수리능력: [
      "회계",
      "세무",
      "예산",
      "정산",
      "통계",
      "수치",
      "데이터",
      "분석",
      "계량",
      "원가",
      "재무",
      "급여",
    ],
    문제해결능력: [
      "문제",
      "개선",
      "해결",
      "시설",
      "안전",
      "전기",
      "기계",
      "설비",
      "운영",
      "유지",
      "점검",
      "관리",
      "장애",
      "현장",
    ],
    자기개발능력: [
      "교육",
      "연구",
      "학습",
      "자격",
      "전문",
      "기술",
      "훈련",
      "개발",
      "성장",
      "신입",
      "인턴",
    ],
    대인관계능력: [
      "협업",
      "팀",
      "조정",
      "갈등",
      "고객",
      "민원",
      "서비스",
      "대응",
      "지원",
      "관계",
      "소통",
    ],
    정보능력: [
      "정보",
      "시스템",
      "전산",
      "it",
      "데이터",
      "자료",
      "분석",
      "보안",
      "소프트웨어",
      "엑셀",
      "프로그램",
      "온라인",
    ],
    직업윤리: [
      "공공",
      "규정",
      "법",
      "윤리",
      "책임",
      "청렴",
      "보안",
      "안전",
      "환경",
      "의료",
      "병원",
      "준수",
      "원칙",
    ],
  };
  const matches = keywordMap[name].reduce(
    (count, keyword) => count + (text.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
  const spread = Array.from(`${profile.companyName}${profile.positionName}${name}`)
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9;
  const score = 28 + matches * 11 + spread;
  return Math.max(24, Math.min(92, score));
}

function buildFallbackProfile(fallback: {
  companyName: string;
  positionName: string;
  dutyText: string;
}) {
  const company = fallback.companyName || "지원 기업";
  const position = fallback.positionName || fallback.dutyText || "지원 직무";
  const duty = fallback.dutyText || position;
  return {
    mainTasks: [
      `${company} ${position} 공고에서 요구하는 직무 내용을 파악하고 수행합니다.`,
      `${duty} 업무에 필요한 자료를 확인하고 정확하게 처리합니다.`,
      `지원 부서와 이해관계자에게 필요한 정보를 정리해 전달합니다.`,
    ],
    requiredKnowledge: [
      `${position} 직무 관련 기본 지식과 업무 절차 이해`,
      `공고에 명시된 자격, 우대사항, 제출 기준에 대한 이해`,
      `자료 확인, 일정 관리, 문서 작성 등 실무 처리 역량`,
    ],
    preferredExperience: [
      `${position} 또는 유사 직무 수행 경험`,
      `협업, 문제 해결, 민원/요청 대응 경험`,
    ],
    keywords: [company, position, ...duty.split(/[,\s/·]+/).filter(Boolean)].slice(0, 8),
  };
}

function withFallbackList(items: string[], fallback: string[], limit: number) {
  const merged = [...items, ...fallback]
    .map((item) => removeJobCodesFromText(item))
    .filter(Boolean);
  return Array.from(new Set(merged)).slice(0, limit);
}

function contextualizeQuestion(
  question: string,
  profile: InterviewAnalysis["profile"],
) {
  const company = profile.companyName;
  const position = profile.positionName || profile.dutyText;
  if (!company && !position) return question;
  if ((company && question.includes(company)) || (position && question.includes(position))) {
    return question;
  }
  const context = [company, position].filter(Boolean).join("의 ");
  return `${context} 기준으로, ${question}`;
}

function normalizeQuestion(
  value: unknown,
  index: number,
  mappings: InterviewAnalysis["ncsMappings"],
  profile: InterviewAnalysis["profile"],
) {
  const record = asRecord(value);
  if (!record) return null;
  const question = removeJobCodesFromText(readString(record.question));
  if (!question) return null;
  const areas = readStringList(record.ncsAreas)
    .map(normalizeNcsAreaName)
    .filter(Boolean) as NcsAreaName[];
  const allowedAreas = constrainQuestionAreas(areas, mappings, index);
  return {
    id: readString(record.id) || `q${index + 1}`,
    type: normalizeQuestionType(record.type, index),
    question: contextualizeQuestion(question, profile),
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
  const fallback = mappings[index % Math.max(mappings.length, 1)]?.name || "문제해결능력";
  return (filtered.length ? filtered : [fallback]).slice(0, 2);
}

function fillQuestions(
  questions: InterviewQuestion[],
  mappings: InterviewAnalysis["ncsMappings"],
  profile: InterviewAnalysis["profile"],
) {
  const company = profile.companyName || "지원 기업";
  const position = profile.positionName || profile.dutyText || "지원 직무";
  const defaults: InterviewQuestion[] = [
    {
      id: "q1",
      type: "experience",
      question: `${company}의 ${position} 직무와 가장 관련 있는 경험을 하나 설명해 주세요.`,
      intent: "직무 이해와 경험의 연결성을 확인합니다.",
      ncsAreas: ["의사소통능력", "문제해결능력"],
      difficulty: "기본",
    },
    {
      id: "q2",
      type: "situation",
      question: `${position} 업무 중 예상하지 못한 문제가 생겼을 때 원인을 파악하고 해결했던 과정을 말씀해 주세요.`,
      intent: "문제해결 과정과 판단 근거를 확인합니다.",
      ncsAreas: ["문제해결능력", "정보능력"],
      difficulty: "기본",
    },
    {
      id: "q3",
      type: "job",
      question: `${company}에서 ${position} 직무를 수행할 때 가장 중요하다고 생각하는 역량은 무엇인가요?`,
      intent: "직무 핵심 역량 이해도를 확인합니다.",
      ncsAreas: [mappings[0]?.name || "정보능력"],
      difficulty: "심화",
    },
    {
      id: "q4",
      type: "personality",
      question: `${position} 업무를 함께 수행하는 팀 안에서 의견이 달랐던 사람과 협업했던 경험을 말씀해 주세요.`,
      intent: "협업 태도와 대인관계능력을 확인합니다.",
      ncsAreas: ["대인관계능력", "의사소통능력"],
      difficulty: "기본",
    },
    {
      id: "q5",
      type: "ethics",
      question: `${company}의 ${position} 담당자로서 규정이나 원칙을 지키기 위해 불편함을 감수했던 경험이 있나요?`,
      intent: "직업윤리와 책임감을 확인합니다.",
      ncsAreas: ["직업윤리"],
      difficulty: "심화",
    },
    {
      id: "q6",
      type: "experience",
      question: `${position} 직무와 관련해 가장 의미 있었던 성과를 상황, 행동, 결과 순서로 설명해 주세요.`,
      intent: "경험을 구조화해 전달하는 능력을 확인합니다.",
      ncsAreas: ["의사소통능력", "문제해결능력"],
      difficulty: "기본",
    },
    {
      id: "q7",
      type: "situation",
      question: `${company}에서 ${position} 업무 우선순위가 충돌했을 때 어떤 기준으로 판단하고 처리하겠습니까?`,
      intent: "우선순위 판단과 실행 방식을 확인합니다.",
      ncsAreas: ["문제해결능력", "직업윤리"],
      difficulty: "심화",
    },
    {
      id: "q8",
      type: "job",
      question: `${position} 직무에서 자주 다뤄야 할 자료나 정보를 어떻게 검토하고 관리하겠습니까?`,
      intent: "정보 활용과 정확성 관리 역량을 확인합니다.",
      ncsAreas: ["정보능력", "의사소통능력"],
      difficulty: "기본",
    },
    {
      id: "q9",
      type: "personality",
      question: `${company}의 ${position} 업무에서 동료가 맡은 일을 제때 끝내지 못해 전체 일정이 지연될 때 어떻게 대응하겠습니까?`,
      intent: "협업 상황에서의 소통과 문제 조정 방식을 확인합니다.",
      ncsAreas: ["대인관계능력", "문제해결능력"],
      difficulty: "심화",
    },
    {
      id: "q10",
      type: "ethics",
      question: `${position} 업무 편의를 위해 절차를 생략하자는 제안을 받는다면 어떻게 하겠습니까?`,
      intent: "규정 준수와 책임감을 확인합니다.",
      ncsAreas: ["직업윤리", "의사소통능력"],
      difficulty: "기본",
    },
    {
      id: "q11",
      type: "experience",
      question: `${position} 직무에 필요한 새로운 업무나 도구를 빠르게 익혀 적용했던 경험을 말씀해 주세요.`,
      intent: "학습 태도와 자기개발능력을 확인합니다.",
      ncsAreas: ["자기개발능력", "정보능력"],
      difficulty: "기본",
    },
    {
      id: "q12",
      type: "situation",
      question: `${company}의 ${position} 업무에서 민원이나 요청 사항이 반복적으로 발생한다면 원인을 어떻게 찾고 개선하겠습니까?`,
      intent: "반복 문제를 분석하고 개선하는 역량을 확인합니다.",
      ncsAreas: ["문제해결능력", "의사소통능력"],
      difficulty: "심화",
    },
    {
      id: "q13",
      type: "job",
      question: `${position} 직무에서 실수를 줄이기 위해 본인이 사용할 점검 방법을 설명해 주세요.`,
      intent: "업무 정확성과 자기관리 방식을 확인합니다.",
      ncsAreas: ["직업윤리", "자기개발능력"],
      difficulty: "기본",
    },
    {
      id: "q14",
      type: "personality",
      question: `${position} 관련 업무에서 상대방이 내 의견을 받아들이지 않을 때 설득하거나 조율했던 경험이 있나요?`,
      intent: "설득과 갈등관리 방식을 확인합니다.",
      ncsAreas: ["대인관계능력", "의사소통능력"],
      difficulty: "기본",
    },
    {
      id: "q15",
      type: "ethics",
      question: `${company} 직원에게 가장 중요하다고 생각하는 태도는 무엇이며, 왜 그렇게 생각하나요?`,
      intent: "공공성과 직업윤리에 대한 이해를 확인합니다.",
      ncsAreas: ["직업윤리"],
      difficulty: "심화",
    },
    {
      id: "q16",
      type: "experience",
      question: `${position} 직무처럼 정해진 기한 안에 여러 업무를 처리했던 경험을 구체적으로 설명해 주세요.`,
      intent: "시간 관리와 실행력을 확인합니다.",
      ncsAreas: ["자기개발능력", "문제해결능력"],
      difficulty: "기본",
    },
    {
      id: "q17",
      type: "situation",
      question: `${position} 업무 중 자료의 숫자나 기준이 서로 맞지 않는 상황을 발견하면 어떻게 확인하겠습니까?`,
      intent: "자료 검증과 수리·정보 활용 능력을 확인합니다.",
      ncsAreas: ["수리능력", "정보능력"],
      difficulty: "심화",
    },
    {
      id: "q18",
      type: "job",
      question: `${company}의 ${position} 직무를 수행하며 가장 먼저 배우고 싶은 업무는 무엇이고, 어떻게 익히겠습니까?`,
      intent: "직무 이해와 성장 계획을 확인합니다.",
      ncsAreas: ["자기개발능력", "정보능력"],
      difficulty: "기본",
    },
    {
      id: "q19",
      type: "personality",
      question: `${position} 업무에서 팀 목표와 개인 방식이 다를 때 본인은 어떤 기준으로 행동하나요?`,
      intent: "조직 적응과 협업 태도를 확인합니다.",
      ncsAreas: ["대인관계능력", "직업윤리"],
      difficulty: "심화",
    },
    {
      id: "q20",
      type: "job",
      question: `${company}의 ${position} 직무에서 고객이나 내부 구성원에게 정보를 설명해야 한다면 어떤 점을 가장 신경 쓰겠습니까?`,
      intent: "상대방 중심의 설명 능력과 직무 소통 역량을 확인합니다.",
      ncsAreas: ["의사소통능력", "정보능력"],
      difficulty: "기본",
    },
  ];
  const merged = [...questions, ...defaults].slice(0, INTERVIEW_QUESTION_COUNT);
  return merged.map((item, index) => ({
    ...item,
    id: `q${index + 1}`,
    ncsAreas: constrainQuestionAreas(item.ncsAreas, mappings, index),
  }));
}

function normalizeAnswerFeedback(
  value: unknown,
  followUpCount: number,
  session: NonNullable<Awaited<ReturnType<typeof findInterviewSessionForViewer>>>,
  question: InterviewQuestion,
): InterviewAnswerFeedback {
  const record = asRecord(value);
  const followUpQuestion =
    followUpCount >= MAX_FOLLOW_UPS_PER_QUESTION
      ? null
      : contextualizeFollowUpQuestion(
        readString(record?.followUpQuestion).slice(0, 240),
        session,
        question,
      );
  return {
    summary:
      removeJobCodesFromText(readString(record?.summary)) ||
      "답변의 핵심 방향은 확인되지만, 상황과 결과를 더 구체적으로 말하면 좋습니다.",
    strengths: ensureDisplayList(record?.strengths, ["직무와 관련된 경험을 답변에 연결했습니다."]),
    improvements: ensureDisplayList(record?.improvements, ["본인 역할, 판단 근거, 결과를 더 구체적으로 보완해 주세요."]),
    nextAnswerGuide:
      removeJobCodesFromText(readString(record?.nextAnswerGuide)) ||
      "다음 답변에서는 상황, 본인 역할, 행동, 결과 순서로 정리해 보세요.",
    followUpQuestion,
  };
}

function contextualizeFollowUpQuestion(
  followUpQuestion: string,
  session: NonNullable<Awaited<ReturnType<typeof findInterviewSessionForViewer>>>,
  question: InterviewQuestion,
) {
  if (!followUpQuestion) return null;
  const hasContext =
    followUpQuestion.includes(session.companyName) ||
    followUpQuestion.includes(session.positionName) ||
    question.ncsAreas.some((area) => followUpQuestion.includes(area));
  if (hasContext) return followUpQuestion;

  return `${session.companyName}의 ${session.positionName} 직무와 ${question.ncsAreas.join(", ")} 역량 기준으로, ${followUpQuestion}`;
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
    summary:
      removeJobCodesFromText(readString(record?.summary)) ||
      "전체적으로 직무와 연결된 답변 방향은 잡혀 있습니다. 다만 면접에서는 본인 역할과 결과를 더 구체적으로 말하는 연습이 필요합니다.",
    strengths: ensureDisplayList(record?.strengths, ["직무 관련 경험을 답변 소재로 활용했습니다."]),
    improvements: ensureDisplayList(record?.improvements, ["상황, 행동, 결과를 더 선명하게 구분해 답변해 보세요."]),
    questionReviews: reviews.length ? reviews : questions.map((question) => ({
      questionId: question.id,
      question: question.question,
      score: 70,
      summary: "답변 방향은 적절하지만 구체성을 보완하면 좋습니다.",
      strengths: ["질문의 핵심 의도에 답변하려는 흐름이 있습니다."],
      improvements: ["본인 역할과 결과를 더 구체적으로 설명해 주세요."],
      ncsAreas: question.ncsAreas,
    })),
    futurePracticeQuestions: ensureDisplayList(record?.futurePracticeQuestions, [
      "지원 직무에서 반복적으로 발생할 수 있는 문제 상황을 하나 정하고 해결 과정을 말해보세요.",
      "본인의 경험 중 공공기관 업무 태도와 연결되는 사례를 말해보세요.",
    ]).slice(0, 5),
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
    summary: removeJobCodesFromText(readString(record?.summary)) || "답변을 기준으로 종합 평가했습니다.",
    strengths: ensureDisplayList(record?.strengths, ["질문에 대한 기본 답변 흐름이 있습니다."]),
    improvements: ensureDisplayList(record?.improvements, ["구체적 근거와 결과를 보완해 주세요."]),
    ncsAreas: areas.length ? areas : fallback?.ncsAreas || ["문제해결능력"],
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

function ensureDisplayList(value: unknown, fallback: string[]) {
  const list = readDisplayStringList(value).slice(0, 4);
  return list.length ? list : fallback;
}

function readStringList(value: unknown) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return normalizeArray(value).map(readString).filter(Boolean);
}

function readDisplayStringList(value: unknown) {
  return readStringList(value).map(removeJobCodesFromText).filter(Boolean);
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
  properties: {
    profile: { type: "object", additionalProperties: true },
    ncsMappings: { type: "array", items: { type: "object", additionalProperties: true } },
    questionPlan: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "object", additionalProperties: true } },
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
