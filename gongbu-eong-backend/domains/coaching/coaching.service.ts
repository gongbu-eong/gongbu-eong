import { createCoachingRequest, createCoachingResult, findCoachingResult, listCoachingHistory } from "./coaching.repository";
import type { CoachingFeedback, CoachingFramework, CoachingInputType, CoachingJobDto, CoachingQuestionInput, CoachingQuestionReview, CoachingReviewSeverity, CoachingSection, CoachingSubmissionReview } from "./coaching.dto";
import { extractResumeDocumentText } from "@/domains/resumes/resumes.ai";
import { createOpenAiJsonResponse, getOpenAiModel, makeOpenAiFileDataUrl } from "@/lib/openai";
export type CoachResumeArgs = { userId: string; inputType: CoachingInputType; inputText: string; file?: { name: string; type: string; buffer: Buffer }; job?: CoachingJobDto | null; jobDuty?: string | null; questions?: CoachingQuestionInput[]; resumeId?: string | null; resumeAdditionalNotes?: string | null; sourceFileId?: string | null };

export async function coachResume(args: CoachResumeArgs) {
  const prepared = await prepareCoachingSource(args);
  return coachPreparedResume(args, prepared);
}

export async function coachPreparedResume(
  args: CoachResumeArgs,
  prepared: PreparedCoachingSource,
) {
  const requestId = await createCoachingRequest({ ...args, inputText: prepared.storageText, jobPostingId: args.job?.id, jobSnapshot: args.job ? { ...args.job, jobDuty: args.jobDuty || null, questions: args.questions || [] } as CoachingJobDto : null, sourceFilename: args.file?.name });
  const feedback = await requestAiFeedback(args, prepared);
  const resultId = await createCoachingResult(requestId, feedback, getOpenAiModel());
  return { resultId, requestId, feedback };
}

export { listCoachingHistory, findCoachingResult };

export type PreparedCoachingSource = { content: Array<Record<string, unknown>>; storageText: string; originalText: string };

export async function prepareCoachingSource(args: CoachResumeArgs): Promise<PreparedCoachingSource> {
  const prompt = buildPrompt(args.job, args.questions || [], args.jobDuty);
  if (args.inputType === "file" && args.file) {
    const imageMediaType = getCoachingImageMediaType(args.file.name);
    if (imageMediaType) {
      return {
        storageText: "",
        originalText: "",
        content: [
          { type: "input_image", image_url: makeOpenAiFileDataUrl(imageMediaType, args.file.buffer), detail: "low" },
          { type: "input_text", text: `${prompt}\n\n첨부한 이미지 파일 전체가 자소서 원문입니다. 이미지 안의 자기소개서 문장을 먼저 읽고, 보이는 텍스트만 근거로 분석하세요.` },
        ],
      };
    }
    if (args.file.name.toLowerCase().endsWith(".pdf")) {
      return {
        storageText: "",
        originalText: "",
        content: [
          { type: "input_file", filename: args.file.name, file_data: makeOpenAiFileDataUrl("application/pdf", args.file.buffer), detail: "low" },
          { type: "input_text", text: `${prompt}\n\n첨부한 PDF 문서 전체가 자소서 원문입니다. 파일명이 아니라 문서 내부의 자기소개서 문장을 읽고 분석하세요.` },
        ],
      };
    }
    const extractedText = await extractResumeDocumentText(args.file.name, args.file.buffer);
    if (!extractedText.trim()) throw new Error("첨부 파일에서 텍스트를 읽지 못했습니다. PDF 또는 텍스트 추출이 가능한 문서로 첨부해 주세요.");
    return { storageText: limitStoredInput(extractedText), originalText: extractedText, content: [{ type: "input_text", text: `${prompt}\n\n첨부한 자소서 원문:\n${extractedText}` }] };
  }
  return { storageText: args.inputText, originalText: args.inputText, content: [{ type: "input_text", text: `${prompt}\n\n자소서 원문:\n${args.inputText}` }] };
}

async function requestAiFeedback(args: CoachResumeArgs, prepared: PreparedCoachingSource): Promise<CoachingFeedback> {
  try {
    const payload = await createOpenAiJsonResponse({
      content: prepared.content as Array<{ type: "input_text"; text: string } | { type: "input_file"; filename: string; file_data: string; detail?: "low" | "high" | "auto" } | { type: "input_image"; image_url: string; detail?: "low" | "high" | "auto" }>,
      schemaName: "coaching_feedback",
      schema: coachingFeedbackTool.input_schema,
      maxOutputTokens: 24000,
    });
    const feedback = normalizeFeedback(payload, prepared.originalText, args.questions || []);
    assertCompleteAiFeedback(feedback);
    return feedback;
  } catch (error) {
    console.error("Invalid coaching response payload", error);
    throw new Error("AI 자소서 코칭 결과를 해석하지 못했습니다. 다시 시도해 주세요.");
  }
}

function getCoachingImageMediaType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

const coachingFeedbackTool = {
  name: "submit_coaching_feedback",
  description: "Submit the structured Korean AI cover letter coaching result.",
  input_schema: {
    type: "object",
    additionalProperties: true,
    required: ["score", "summary", "originalTextExcerpt", "evaluationScores", "jobConnection", "sections", "rewrittenText"],
    properties: {
      score: { type: "number" },
      summary: { type: "string", maxLength: 500 },
      originalTextExcerpt: { type: "string", maxLength: 1200 },
      evaluationScores: {
        type: "array",
        minItems: 4,
        items: {
          type: "object",
          additionalProperties: true,
          required: ["label", "score"],
          properties: {
            label: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
      detailEvaluation: { type: "array", maxItems: 4, items: { type: "string", maxLength: 240 } },
      jobConnection: { type: "object", additionalProperties: true },
      questionFeedback: { type: "array", items: { type: "object", additionalProperties: true } },
      improvementSuggestions: { type: "array", maxItems: 5, items: { type: "string", maxLength: 220 } },
      sentenceEdits: { type: "array", items: { type: "object", additionalProperties: true } },
      sections: { type: "array", items: { type: "object", additionalProperties: true } },
      submissionReview: {
        type: "object",
        additionalProperties: true,
        properties: {
          preSubmitChecks: { type: "number", minimum: 0 },
          fixSuggestions: { type: "number", minimum: 0 },
          keepCount: { type: "number", minimum: 0 },
          strongestQuestion: { type: "object", additionalProperties: true },
          priorityImprovement: { type: "object", additionalProperties: true },
          overallAssessment: { type: "object", additionalProperties: true },
          questions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                question: { type: "string", maxLength: 600 },
                tabTitle: { type: "string", maxLength: 12 },
                answer: { type: "string", maxLength: 1400 },
                characterLimit: { type: ["number", "null"] },
                characterCount: { type: "number" },
                exceededBy: { type: "number" },
                frameworks: { type: "array", items: { type: "string", enum: ["PREP", "CAR", "PAP", "STAR"] } },
                editCount: { type: "number" },
                methodComment: { type: "string", maxLength: 500 },
                resumeEvidence: { type: "array", maxItems: 4, items: { type: "string", maxLength: 200 } },
                ncsEvaluations: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: true } },
                coachingPoints: { type: "object", additionalProperties: true },
                structureChecks: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: true } },
                comparisonEdits: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: true } },
                majorRevisions: { type: "array", maxItems: 3, items: { type: "string", maxLength: 220 } },
                factualChecks: { type: "array", maxItems: 3, items: { type: "string", maxLength: 220 } },
                highlights: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: true,
                    properties: {
                      original: { type: "string", maxLength: 160 },
                      severity: { type: "string", enum: ["check", "fix", "keep"] },
                      label: { type: "string", maxLength: 30 },
                      note: { type: "string", maxLength: 420 },
                    },
                  },
                },
                edits: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: true,
                    properties: {
                      index: { type: "number" },
                      frameworkPart: { type: "string", maxLength: 30 },
                      severity: { type: "string", enum: ["check", "fix", "keep"] },
                      title: { type: "string", maxLength: 60 },
                      issue: { type: "string", maxLength: 520 },
                      suggestion: { type: "string", maxLength: 560 },
                      replacement: { type: "string", maxLength: 520 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      rewrittenText: { type: "string", maxLength: 1000 },
    },
  },
} as const;

function buildPrompt(job?: CoachingJobDto | null, questions: CoachingQuestionInput[] = [], jobDuty?: string | null) {
  const duty = jobDuty?.trim() ? `\n사용자가 이 공고에서 지원하려는 직무: ${jobDuty.trim()}` : "";
  const questionGuide = questions.length
    ? `\n\n사용자가 입력한 자소서 문항과 글자 수 제한입니다. submissionReview.questions는 반드시 이 순서와 개수 그대로 반환하세요.\n${questions.map((item, index) => `${index + 1}. 문항: ${item.question || "문항 미입력"} / 글자 수 제한: ${item.characterLimit || "없음"}`).join("\n")}`
    : "\n\n사용자가 별도 문항을 입력하지 않았습니다. submissionReview.questions에는 제출 원문 전체를 하나의 일반 문항으로 분석한 항목 1개를 반환하세요.";
  return `한국어 NCS 자기소개서 코치입니다. ${job ? `지원 공고: ${job.institutionName} / ${job.title}` : "지원 공고가 없는 일반 코칭"} 기준으로 제출 자소서를 분석하세요.${duty}

반드시 지정된 JSON 스키마에 맞는 JSON 객체 하나로만 결과를 제출하세요. markdown, 코드블록, 설명 문장은 금지합니다.
JSON이 길어져 중간에 끊기지 않도록 모든 문장은 간결하게 작성하세요. 같은 원문 문단을 여러 필드에 반복해서 길게 복사하지 마세요.
파일 첨부인 경우 파일명은 분석 대상이 아닙니다. 문서 내부의 자기소개서 문장만 분석하세요.
모든 피드백, 점수, 개선 제안, 문장별 첨삭, 개선 예시문은 제출 원문과 공고 내용을 근거로 AI가 새로 작성해야 합니다. 샘플 문장이나 고정 문구를 반복하지 마세요.
summary는 최소 4문장 이상 작성하고, 현재 강점·가장 큰 리스크·직무 연결성·우선 수정 방향을 모두 포함하세요.
각 feedback/comment/suggestion/reason은 근거와 수정 방향이 보이도록 2~4문장으로 작성하세요. 한 줄짜리 짧은 평은 금지합니다.
coachingPoints의 각 배열 항목은 문항별 원문과 NCS 역량을 연결해 구체적으로 작성하고, 추상적인 조언만 쓰지 마세요.
originalTextExcerpt는 문장별 첨삭에 그대로 보여줄 제출 원문 핵심 문단 400~700자입니다. sentenceEdits[].original은 반드시 originalTextExcerpt 안에 포함되는 정확한 연속 부분 문자열이어야 하며, 요약·새 문장·비슷한 표현으로 바꾸면 안 됩니다.
rewrittenText는 originalTextExcerpt를 공고에 맞춰 다시 쓴 after 문단이며 700자 이내로 작성하세요.
sentenceEdits[].original은 반드시 제출 원문에서 그대로 가져온 표현이어야 합니다.
jobConnection과 sections의 각 항목은 서로 다른 관점으로 분석하고, sentenceEdits를 정확히 2개만 포함하세요. 같은 sentenceEdits[].original을 여러 항목에 반복해서 넣지 마세요.
jobConnection과 sections의 각 항목별 sentenceEdits에는 반드시 good: false인 "보완이 필요한 표현" 1개 이상과 good: true인 "잘 쓴 표현" 1개 이상을 함께 넣으세요. 두 표현 모두 해당 항목의 판단 근거와 직접 관련된 원문 구절이어야 합니다.
jobConnection은 "직무 연결성"입니다. 지원 공고의 자격요건/주요 업무와 제출 자소서의 경험, 자격, 성과가 얼마나 연결되는지 판단하세요.
sections는 정확히 "지원동기", "경험 서술", "입사 후 포부" 순서입니다.
"지원동기"는 회사/기관/직무를 선택한 이유와 지원자의 동기가 설득력 있는지 판단하세요.
"경험 서술"은 경험의 배경, 역할, 행동, 성과가 구체적으로 드러나는지 판단하세요. 원문에 프로젝트, 경험, 성과, 업무 내용이 있으면 반드시 이 항목의 sentenceEdits에 포함하세요.
"입사 후 포부"는 입사 후 목표, 기여 방식, 직무 수행 계획이 구체적인지 판단하세요.
jobConnection과 sections의 feedback은 해당 항목에 대한 AI 판단을 2~4문장으로 작성하세요.
jobConnection과 sections의 suggestion은 반드시 "예: "로 시작하는 구체적인 개선 문장 또는 개선 방향 한 문장으로 작성하세요.
status는 "good" 또는 "needs_work"입니다. sentenceEdits[].good은 잘 쓴 표현이면 true, 보완이 필요한 표현이면 false입니다.
문장별 첨삭은 화면에서 한 문단 안에 보완 표현과 좋은 표현을 밑줄/배경색으로 표시합니다. 따라서 sentenceEdits[].original은 화면에 표시할 원문 문장 안에서 정확히 찾을 수 있는 짧거나 중간 길이의 구절로 선택하세요.
sentenceEdits[].improved는 보완이 필요한 표현이면 대체 문장을, 잘 쓴 표현이면 왜 유지하면 좋은지에 맞춘 개선 방향을 작성하세요.
questionFeedback에는 "전체 문항"을 넣지 마세요.
${questionGuide}

반환 JSON 필드:
score, summary, originalTextExcerpt, evaluationScores, detailEvaluation, jobConnection, questionFeedback, improvementSuggestions, sentenceEdits, sections, rewrittenText, submissionReview

evaluationScores는 반드시 아래 4개 항목을 이 순서로 반환하세요. 각 score는 제출 자소서와 지원 공고를 AI가 판단한 0~100점 숫자입니다.
[
  { "label": "NCS 역량 표현", "score": 0~100 },
  { "label": "문항 적합성", "score": 0~100 },
  { "label": "구체성·근거", "score": 0~100 },
  { "label": "논리·가독성", "score": 0~100 }
]
detailEvaluation은 세부평가 그래프 대신 보여주는 필드가 아닙니다. evaluationScores 점수 산정 이유를 저장용 보조 설명으로만 작성하세요.

jobConnection 형식:
{ "title": "직무 연결성", "status": "good|needs_work", "feedback": "AI 판단 문장", "suggestion": "예: 개선 문장", "sentenceEdits": [{ "original": "원문에서 보완이 필요한 표현", "improved": "개선 문장", "reason": "판단 근거", "good": false }, { "original": "원문에서 잘 쓴 표현", "improved": "유지하면 좋은 이유", "reason": "판단 근거", "good": true }] }

sections 형식:
[
  { "title": "지원동기", "status": "good|needs_work", "feedback": "AI 판단 문장", "suggestion": "예: 개선 문장", "sentenceEdits": [...] },
  { "title": "경험 서술", "status": "good|needs_work", "feedback": "AI 판단 문장", "suggestion": "예: 개선 문장", "sentenceEdits": [...] },
  { "title": "입사 후 포부", "status": "good|needs_work", "feedback": "AI 판단 문장", "suggestion": "예: 개선 문장", "sentenceEdits": [...] }
]

submissionReview는 새 결과 화면의 핵심 데이터입니다.
submissionReview.preSubmitChecks는 제출 전 반드시 확인해야 하는 지적 수, fixSuggestions는 고치면 좋은 곳 수, keepCount는 그대로 두어도 좋은 표현 수입니다.
2026년 기준 NCS 직업기초능력은 다음 7대 역량과 하위 역량을 기준으로 판단하세요.
1. 의사소통능력: 문서이해, 문서작성, 경청
2. 수리능력: 기초연산, 기초통계, 도표분석
3. 문제해결능력: 사고력, 문제처리, 자원관리
4. 자기개발능력: 자기관리, 경력개발, 학습관리
5. 대인관계능력: 팀워크, 리더십, 갈등관리
6. 정보능력: 정보수집, 정보분석, 컴퓨터활용
7. 직업윤리: 근로윤리, 공동체윤리, 안전의식
submissionReview.strongestQuestion은 문항 중 가장 강한 포인트 1개입니다. { "questionIndex": 1부터 시작, "title": "최대 8글자 제목", "ncsName": "NCS 역량명", "comment": "AI 판단 2~3문장" } 형식입니다.
submissionReview.priorityImprovement는 가장 먼저 보완할 사항 1개입니다. { "questionIndex": 1부터 시작, "title": "최대 8글자 제목", "ncsName": "부족한 NCS 역량명", "comment": "AI 판단 2~3문장" } 형식입니다.
submissionReview.overallAssessment는 전체 평가 하단에 보여줄 종합 가이드입니다. { "strengths": "현재 강점", "firstFix": "가장 먼저 고칠 것", "principle": "첨삭 원칙" } 형식입니다.
submissionReview.questions[].tabTitle은 질문 내용을 AI가 최대 8글자 한국어 제목으로 요약한 값입니다. "1.", "2." 같은 문항 번호는 포함하지 마세요.
submissionReview.questions[].answer는 해당 문항에 대응되는 제출 원문을 원문 순서대로 담되 1200자를 넘기지 마세요. 문항별 구분이 불분명하면 제출 원문 전체에서 가장 관련 있는 문단을 사용하세요.
submissionReview.questions[].characterCount는 answer의 실제 글자 수, exceededBy는 characterLimit을 초과한 글자 수입니다. 제한이 없거나 초과하지 않으면 0입니다.
submissionReview.questions[].ncsEvaluations는 선택된 문항의 NCS 기준 평가입니다. 최소 2개 이상, 최대 3개까지 반환하세요. 각 항목은 { "name": "NCS 역량명 또는 하위 역량명", "comment": "AI 코멘트", "score": 0~100 }입니다.
submissionReview.questions[].coachingPoints는 { "strengths": ["잘한 점"], "improvements": ["보완할 점"], "ncsSuggestions": ["NCS 기준 제안"] }입니다. 각 배열은 1~3개입니다.
submissionReview.questions[].structureChecks는 PREP, CAR, PAP, STAR 4개를 모두 반환하세요. 각 항목은 { "framework": "PREP|CAR|PAP|STAR", "status": "good|needs_work", "comment": "AI 판단 코멘트" }입니다.
submissionReview.questions[].frameworks는 해당 문항에 적용되는 PREP, CAR, PAP, STAR 중 하나 이상입니다. 여러 개면 모두 넣으세요.
PREP는 주장→이유→사례→재강조, CAR는 배경→행동→결과, PAP는 문제/갈등→해결 접근→재강조, STAR는 상황→과제→행동→결과입니다.
submissionReview.questions[].highlights는 화면에서 원문 answer 안에 밑줄과 배경색으로 표시할 정확한 연속 부분 문자열입니다. original은 반드시 answer 안에서 찾을 수 있어야 합니다. severity는 "check"(제출 전 확인), "fix"(고치면 좋은 곳), "keep"(그대로 두세요) 중 하나입니다.
각 질문마다 highlights에는 가능한 한 fix와 keep을 모두 포함하세요. 정말 유지할 표현이 없을 때만 keep을 생략하세요.
submissionReview.questions[].edits는 하이라이트와 연결되는 첨삭 카드입니다. frameworkPart는 "P · 주장", "R · 이유", "E · 사례", "C · 배경", "A · 행동", "R · 결과", "S · 상황", "T · 과제"처럼 방법론 단계가 보이게 작성하세요.
edits[].issue는 왜 문제인지 또는 왜 유지하면 좋은지 2문장 이상, suggestion은 어떻게 바꾸거나 유지하면 좋은지 2문장 이상 작성하세요. replacement는 대체 문장이 있을 때만 작성하세요.
submissionReview.questions[].comparisonEdits는 비교 탭에서 보여줄 문장별 원문과 첨삭입니다. 각 항목은 { "original": "원문 문장", "improved": "첨삭 문장", "reason": "수정 이유" }입니다. 최대 4개만 반환하세요.
submissionReview.questions[].majorRevisions는 주요 수정 3건입니다. 원문에 근거한 핵심 수정 포인트를 3개 반환하세요.
submissionReview.questions[].factualChecks는 사실성 체크입니다. 자소서에 작성된 수치, 기관명, 경험 기간, 성과처럼 제출 전 확인해야 할 내용을 1~3개 반환하세요.`;
}

function normalizeFeedback(value: Partial<CoachingFeedback>, sourceText = "", questions: CoachingQuestionInput[] = []): CoachingFeedback {
  const score = Math.max(0, Math.min(100, Number(value.score) || 0));
  const originalTextExcerpt = makeOriginalExcerpt(value.originalTextExcerpt || sourceText);
  const questionFeedback = normalizeQuestionFeedback(value.questionFeedback).filter((item) => item.question !== "전체 문항");
  const globalEdits = normalizeSentenceEdits(value.sentenceEdits);
  const usedEditTexts = new Set<string>();
  const rawJobConnection = asRecord(value.jobConnection) || asRecord(questionFeedback.find((item) => item.question === "직무 연결성"));
  const jobConnectionEdits = ensureBalancedSentenceEdits("직무 연결성", takeUniqueEdits(normalizeSentenceEdits(rawJobConnection?.sentenceEdits), usedEditTexts, 5), originalTextExcerpt, usedEditTexts);
  const jobConnectionFeedback = readString(rawJobConnection?.feedback) || readString(questionFeedback.find((item) => item.question === "직무 연결성")?.feedback) || "지원 직무와 자소서 경험의 연결을 확인해 보세요.";
  const jobConnectionSuggestion = formatExampleSuggestion(readString(rawJobConnection?.suggestion) || readString(questionFeedback.find((item) => item.question === "직무 연결성")?.suggestion) || "관련 이력과 자격을 공고의 주요 업무 앞부분에 배치해 보세요.");
  const jobConnection: CoachingSection = { title: "직무 연결성", status: normalizeStatus(rawJobConnection?.status), feedback: jobConnectionFeedback, suggestion: jobConnectionSuggestion, sentenceEdits: jobConnectionEdits };
  if (!jobConnection.sentenceEdits?.length) jobConnection.sentenceEdits = makeSectionFallbackEdits("직무 연결성", originalTextExcerpt, jobConnection.feedback, jobConnection.suggestion || "", usedEditTexts);
  const sectionTitles = ["지원동기", "경험 서술", "입사 후 포부"];
  const rawSections = normalizeRawSections(value.sections);
  const sections = sectionTitles.map((title) => {
    const item = rawSections.find((section) => readString(section.title) === title);
    const questionItem = questionFeedback.find((entry) => entry.question === title);
    const feedback = readString(item?.feedback) || readString(questionItem?.feedback) || defaultSectionFeedback(title);
    const suggestion = formatExampleSuggestion(readString(item?.suggestion) || readString(questionItem?.suggestion) || defaultSectionSuggestion(title));
    const edits = ensureBalancedSentenceEdits(title, takeUniqueEdits(normalizeSentenceEdits(item?.sentenceEdits), usedEditTexts, 5), originalTextExcerpt, usedEditTexts);
    return { title, status: normalizeStatus(item?.status), feedback, suggestion, sentenceEdits: edits.length ? edits : makeSectionFallbackEdits(title, originalTextExcerpt, feedback, suggestion, usedEditTexts), example: readString(item?.example) };
  });
  const rewrittenText = readString(value.rewrittenText) || sections.map((item) => item.example).filter(Boolean).join("\n\n");
  const evaluationScores = normalizeEvaluationScores(value.evaluationScores, score);
  const submissionReview = normalizeSubmissionReview(value.submissionReview, sourceText || originalTextExcerpt, questions, [...jobConnection.sentenceEdits || [], ...sections.flatMap((item) => item.sentenceEdits || [])]);
  return { score, summary: readString(value.summary) || "자소서의 흐름과 직무 연결을 중심으로 코칭했어요.", originalTextExcerpt, evaluationScores, detailEvaluation: normalizeStringList(value.detailEvaluation), jobConnection, questionFeedback, improvementSuggestions: normalizeStringList(value.improvementSuggestions), sentenceEdits: globalEdits, sections, rewrittenText, submissionReview };
}

function normalizeSubmissionReview(value: unknown, sourceText: string, questions: CoachingQuestionInput[], fallbackEdits: Array<{ original: string; improved: string; reason: string; good?: boolean }>): CoachingSubmissionReview {
  const record = asRecord(value);
  const rawQuestions = normalizeUnknownArray(record?.questions);
  const source = sourceText.trim();
  const questionInputs = questions.length ? questions : [{ question: "자소서 문항", characterLimit: null }];
  const reviews = questionInputs.map((input, index) => normalizeQuestionReview(rawQuestions[index], input, index, source, fallbackEdits));
  const fallbackFixCount = reviews.reduce((sum, item) => sum + item.highlights.filter((highlight) => highlight.severity === "fix").length, 0);
  const fallbackKeepCount = reviews.reduce((sum, item) => sum + item.highlights.filter((highlight) => highlight.severity === "keep").length, 0);
  const fallbackCheckCount = reviews.reduce((sum, item) => sum + item.highlights.filter((highlight) => highlight.severity === "check").length + (item.exceededBy > 0 ? 1 : 0), 0);
  return {
    preSubmitChecks: Math.max(0, Math.round(Number(record?.preSubmitChecks) || fallbackCheckCount)),
    fixSuggestions: Math.max(0, Math.round(Number(record?.fixSuggestions) || fallbackFixCount)),
    keepCount: Math.max(0, Math.round(Number(record?.keepCount) || fallbackKeepCount)),
    strongestQuestion: normalizeQuestionSummary(record?.strongestQuestion, reviews, "strongest"),
    priorityImprovement: normalizeQuestionSummary(record?.priorityImprovement, reviews, "priority"),
    overallAssessment: normalizeOverallAssessment(record?.overallAssessment),
    questions: reviews,
  };
}

function normalizeQuestionReview(rawValue: unknown, input: CoachingQuestionInput, index: number, sourceText: string, fallbackEdits: Array<{ original: string; improved: string; reason: string; good?: boolean }>): CoachingQuestionReview {
  const raw = asRecord(rawValue);
  const answer = readString(raw?.answer) || pickQuestionAnswer(sourceText, index);
  const characterLimit = normalizeCharacterLimit(raw?.characterLimit ?? input.characterLimit);
  const characterCount = Math.max(0, Math.round(Number(raw?.characterCount) || countKoreanChars(answer)));
  const exceededBy = Math.max(0, Math.round(Number(raw?.exceededBy) || (characterLimit ? characterCount - characterLimit : 0)));
  const frameworks = normalizeFrameworks(raw?.frameworks);
  const highlights = normalizeQuestionHighlights(raw?.highlights, answer, fallbackEdits);
  const edits = normalizeQuestionEdits(raw?.edits, highlights);
  const majorRevisions = normalizeStringList(raw?.majorRevisions).slice(0, 3);
  const factualChecks = normalizeStringList(raw?.factualChecks).slice(0, 3);
  return {
    question: readString(raw?.question) || input.question || `문항 ${index + 1}`,
    tabTitle: makeTabTitle(readString(raw?.tabTitle) || readString(raw?.question) || input.question || `문항 ${index + 1}`),
    answer,
    characterLimit,
    characterCount,
    exceededBy,
    frameworks: frameworks.length ? frameworks : inferFrameworks(input.question, answer),
    editCount: Math.max(0, Math.round(Number(raw?.editCount) || edits.length || highlights.length)),
    methodComment: readString(raw?.methodComment) || "문항의 요구와 원문 흐름을 기준으로 NCS 작성 틀을 적용했어요.",
    resumeEvidence: normalizeStringList(raw?.resumeEvidence).slice(0, 4),
    ncsEvaluations: normalizeNcsEvaluations(raw?.ncsEvaluations, answer),
    coachingPoints: normalizeCoachingPoints(raw?.coachingPoints, edits, highlights),
    structureChecks: normalizeStructureChecks(raw?.structureChecks, frameworks.length ? frameworks : inferFrameworks(input.question, answer)),
    comparisonEdits: normalizeComparisonEdits(raw?.comparisonEdits, edits),
    majorRevisions: majorRevisions.length ? majorRevisions : makeMajorRevisionFallback(edits),
    factualChecks: factualChecks.length ? factualChecks : makeFactualCheckFallback(answer),
    highlights,
    edits,
  };
}

function normalizeQuestionHighlights(value: unknown, answer: string, fallbackEdits: Array<{ original: string; improved: string; reason: string; good?: boolean }>) {
  const fromAi = normalizeUnknownArray(value).map((item) => {
    const record = asRecord(item);
    if (!record) return null;
    const original = readString(record.original) || readString(record.text);
    if (!original || !findTextRange(answer, original)) return null;
    return {
      original,
      severity: normalizeReviewSeverity(record.severity),
      label: readString(record.label) || defaultSeverityLabel(normalizeReviewSeverity(record.severity)),
      note: readString(record.note) || readString(record.reason),
    };
  }).filter(Boolean) as CoachingQuestionReview["highlights"];
  if (fromAi.length) return fromAi.slice(0, 8);
  const picked = fallbackEdits.filter((edit) => edit.original && findTextRange(answer, edit.original)).slice(0, 4);
  if (picked.length) {
    return picked.map((edit) => ({ original: edit.original, severity: edit.good ? "keep" as const : "fix" as const, label: edit.good ? "그대로 두세요" : "고치면 좋은 곳", note: edit.reason }));
  }
  const sentences = answer.split(/\n|(?<=[.!?。])\s+/).map((item) => item.trim()).filter((item) => item.length >= 10);
  return sentences.slice(0, 2).map((sentence, idx) => ({ original: sentence.slice(0, 120), severity: idx === 0 ? "fix" as const : "keep" as const, label: idx === 0 ? "고치면 좋은 곳" : "그대로 두세요", note: idx === 0 ? "더 구체적인 근거를 붙이면 좋아요." : "지원자의 태도가 드러나는 표현입니다." }));
}

function normalizeQuestionEdits(value: unknown, highlights: CoachingQuestionReview["highlights"]) {
  const fromAi = normalizeUnknownArray(value).map((item, index) => {
    const record = asRecord(item);
    if (!record) return null;
    return {
      index: Math.max(1, Math.round(Number(record.index) || index + 1)),
      frameworkPart: readString(record.frameworkPart) || "P · 주장",
      severity: normalizeReviewSeverity(record.severity),
      title: readString(record.title) || defaultSeverityLabel(normalizeReviewSeverity(record.severity)),
      issue: readString(record.issue) || readString(record.reason) || "원문 표현을 기준으로 확인이 필요합니다.",
      suggestion: readString(record.suggestion) || "문항의 요구와 공고의 직무에 맞춰 더 구체적으로 다듬어 보세요.",
      replacement: readString(record.replacement) || undefined,
    };
  }).filter(Boolean) as CoachingQuestionReview["edits"];
  if (fromAi.length) return fromAi.slice(0, 10);
  return highlights.map((highlight, index) => ({
    index: index + 1,
    frameworkPart: frameworkPartByIndex(index),
    severity: highlight.severity,
    title: highlight.label,
    issue: highlight.note || "원문에서 확인한 표현입니다.",
    suggestion: highlight.severity === "keep" ? "이 표현은 유지하고 앞뒤 문장과 자연스럽게 연결해 주세요." : "구체적인 역할, 행동, 결과가 드러나도록 보완해 주세요.",
  }));
}

function normalizeQuestionSummary(value: unknown, reviews: CoachingQuestionReview[], mode: "strongest" | "priority") {
  const record = asRecord(value);
  const rawIndex = Math.round(Number(record?.questionIndex) || 1);
  const questionIndex = Math.min(Math.max(rawIndex, 1), Math.max(reviews.length, 1));
  const review = reviews[questionIndex - 1] || reviews[0];
  const title = makeTabTitle(readString(record?.title) || review?.tabTitle || review?.question || (mode === "strongest" ? "강점문항" : "보완문항"));
  const ncsName = readString(record?.ncsName) || (mode === "strongest" ? "직업윤리" : "문제해결능력");
  const comment = readString(record?.comment) || (mode === "strongest" ? "문항 요구에 맞는 강점이 비교적 선명하게 드러납니다." : "가장 먼저 구체적인 행동과 근거를 보완해 주세요.");
  return { questionIndex, title, ncsName, comment };
}

function normalizeOverallAssessment(value: unknown) {
  const record = asRecord(value);
  return {
    strengths: readString(record?.strengths) || "지원자의 경험과 태도를 보여주는 문장은 유지할 만합니다.",
    firstFix: readString(record?.firstFix) || "가장 먼저 공고의 직무 요구와 연결되는 구체적 행동, 수치, 결과를 보완하세요.",
    principle: readString(record?.principle) || "원문 표현을 살리되 NCS 역량, 역할, 행동, 결과가 한 문단 안에서 확인되도록 다듬는 것이 좋습니다.",
  };
}

function normalizeNcsEvaluations(value: unknown, answer: string) {
  const fromAi = normalizeUnknownArray(value).map((item) => {
    const record = asRecord(item);
    if (!record) return null;
    return {
      name: readString(record.name) || "NCS 역량",
      comment: readString(record.comment) || "원문 기준으로 확인한 역량입니다.",
      score: Math.max(0, Math.min(100, Math.round(Number(record.score) || 0))),
    };
  }).filter(Boolean) as NonNullable<CoachingQuestionReview["ncsEvaluations"]>;
  if (fromAi.length) return fromAi.slice(0, 4);
  const inferred = /데이터|분석|자료|문서|컴퓨터|엑셀|Excel/i.test(answer)
    ? ["정보능력", "문제해결능력"]
    : ["의사소통능력", "직업윤리"];
  return inferred.map((name, index) => ({
    name,
    comment: index === 0 ? "원문에서 비교적 잘 드러나는 NCS 역량입니다." : "근거를 더 구체화하면 더 선명해지는 역량입니다.",
    score: index === 0 ? 76 : 68,
  }));
}

function normalizeCoachingPoints(value: unknown, edits: CoachingQuestionReview["edits"], highlights: CoachingQuestionReview["highlights"]) {
  const record = asRecord(value);
  const strengths = normalizeStringList(record?.strengths).slice(0, 3);
  const improvements = normalizeStringList(record?.improvements).slice(0, 3);
  const ncsSuggestions = normalizeStringList(record?.ncsSuggestions).slice(0, 3);
  return {
    strengths: strengths.length ? strengths : [highlights.find((item) => item.severity === "keep")?.note || "지원자의 태도나 경험이 드러나는 표현은 유지해도 좋습니다."],
    improvements: improvements.length ? improvements : [edits.find((item) => item.severity !== "keep")?.suggestion || "역할, 행동, 결과를 더 구체적으로 보완해 주세요."],
    ncsSuggestions: ncsSuggestions.length ? ncsSuggestions : ["NCS 역량명이 직접 드러나도록 경험의 행동과 결과를 연결해 주세요."],
  };
}

function normalizeStructureChecks(value: unknown, frameworks: CoachingFramework[]) {
  const fromAi = normalizeUnknownArray(value).map((item) => {
    const record = asRecord(item);
    const framework = readString(record?.framework).toUpperCase() as CoachingFramework;
    if (!["PREP", "CAR", "PAP", "STAR"].includes(framework)) return null;
    return {
      framework,
      status: normalizeStatus(record?.status),
      comment: readString(record?.comment) || "구조 기준으로 점검했습니다.",
    };
  }).filter(Boolean) as NonNullable<CoachingQuestionReview["structureChecks"]>;
  if (fromAi.length >= 4) return fromAi;
  const selected = new Set(frameworks);
  return (["PREP", "CAR", "PAP", "STAR"] as CoachingFramework[]).map((framework) => ({
    framework,
    status: selected.has(framework) ? "good" as const : "needs_work" as const,
    comment: selected.has(framework) ? `${framework} 구조와 맞는 흐름이 일부 확인됩니다.` : `${framework} 구조로 보려면 빠진 단계가 있어 보완이 필요합니다.`,
  }));
}

function normalizeComparisonEdits(value: unknown, edits: CoachingQuestionReview["edits"]) {
  const fromAi = normalizeUnknownArray(value).map((item) => {
    const record = asRecord(item);
    if (!record) return null;
    const original = readString(record.original);
    const improved = readString(record.improved) || readString(record.replacement);
    if (!original || !improved) return null;
    return { original, improved, reason: readString(record.reason) || "문항과 NCS 기준에 맞춰 다듬었습니다." };
  }).filter(Boolean) as NonNullable<CoachingQuestionReview["comparisonEdits"]>;
  if (fromAi.length) return fromAi.slice(0, 8);
  return edits.filter((item) => item.replacement).slice(0, 4).map((item) => ({ original: item.issue, improved: item.replacement!, reason: item.suggestion }));
}

function makeMajorRevisionFallback(edits: CoachingQuestionReview["edits"]) {
  const revisions = edits.filter((item) => item.severity !== "keep").map((item) => item.suggestion).filter(Boolean).slice(0, 3);
  return revisions.length ? revisions : ["공고의 직무와 직접 연결되는 경험을 앞부분에 배치하세요.", "역할, 행동, 결과가 한 문장 안에서 확인되도록 문장을 정리하세요.", "추상적인 표현보다 수치나 기간 같은 근거를 추가하세요."];
}

function makeFactualCheckFallback(answer: string) {
  const checks: string[] = [];
  if (/\d/.test(answer)) checks.push("원문에 작성한 수치, 기간, 건수가 실제 근거와 일치하는지 확인하세요.");
  if (/기관|공사|공단|회사|지원/.test(answer)) checks.push("기관명, 직무명, 지원 분야가 실제 공고와 같은지 제출 전 확인하세요.");
  if (!checks.length) checks.push("경험과 성과가 실제 수행한 내용인지 제출 전 다시 확인하세요.");
  return checks.slice(0, 3);
}

function makeTabTitle(value: string) {
  const cleaned = value.replace(/^\s*\d+\s*[.)]\s*/, "").replace(/\s+/g, "");
  return (cleaned || "자소서").slice(0, 8);
}

function normalizeFrameworks(value: unknown): CoachingFramework[] {
  const allowed = new Set<CoachingFramework>(["PREP", "CAR", "PAP", "STAR"]);
  return normalizeUnknownArray(value).map((item) => readString(item).toUpperCase()).filter((item): item is CoachingFramework => allowed.has(item as CoachingFramework));
}

function inferFrameworks(question: string, answer: string): CoachingFramework[] {
  const text = `${question} ${answer}`;
  const result: CoachingFramework[] = [];
  if (/지원|동기|가치|포부|생각|의견|목표/.test(text)) result.push("PREP");
  if (/프로젝트|업무|경험|성과|결과|개선|수행/.test(text)) result.push("CAR");
  if (/문제|갈등|위기|해결|어려움|극복/.test(text)) result.push("PAP");
  if (/상황|과제|행동|역할|결과|경험/.test(text)) result.push("STAR");
  return result.length ? [...new Set(result)] : ["PREP"];
}

function normalizeReviewSeverity(value: unknown): CoachingReviewSeverity {
  const text = readString(value).toLowerCase();
  if (["keep", "good", "그대로", "좋아요", "잘쓴표현"].includes(text)) return "keep";
  if (["check", "warning", "확인", "제출전확인"].includes(text)) return "check";
  return "fix";
}

function defaultSeverityLabel(severity: CoachingReviewSeverity) {
  if (severity === "keep") return "그대로 두세요";
  if (severity === "check") return "제출 전 확인";
  return "고치면 좋은 곳";
}

function frameworkPartByIndex(index: number) {
  return ["P · 주장", "R · 이유", "E · 사례", "A · 행동"][index % 4];
}

function normalizeCharacterLimit(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function countKoreanChars(value: string) {
  return Array.from(value.replace(/\s/g, "")).length;
}

function pickQuestionAnswer(sourceText: string, index: number) {
  const blocks = sourceText.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return (blocks[index] || sourceText || "제출한 자소서 원문을 기준으로 분석했습니다.").trim();
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

function normalizeQuestionFeedback(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const record = asRecord(item);
      return { question: readString(record?.question), feedback: readString(record?.feedback), suggestion: readString(record?.suggestion) };
    }).filter((item) => item.question || item.feedback || item.suggestion);
  }
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).map(([question, item]) => {
    const nested = asRecord(item);
    return { question: readString(nested?.question) || question, feedback: readString(nested?.feedback) || (nested ? "" : readString(item)), suggestion: readString(nested?.suggestion) };
  }).filter((item) => item.question || item.feedback || item.suggestion);
}

function normalizeRawSections(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).map(([title, item]) => ({ ...(asRecord(item) || {}), title }));
}

function normalizeSentenceEdits(value: unknown = []) {
  return normalizeUnknownArray(value).map((item) => {
    const record = asRecord(item);
    if (!record) return null;
    const original = readString(record.original) || readString(record.before) || readString(record.text) || readString(record.expression);
    if (!original) return null;
    return { original, improved: readString(record.improved) || readString(record.after), reason: readString(record.reason) || readString(record.feedback), good: normalizeGoodFlag(record.good) };
  }).filter(Boolean) as Array<{ original: string; improved: string; reason: string; good: boolean }>;
}

function normalizeEvaluationScores(value: unknown, totalScore: number) {
  const requiredLabels = ["NCS 역량 표현", "문항 적합성", "구체성·근거", "논리·가독성"];
  const normalizeScore = (score: unknown) => Math.max(0, Math.min(100, Number(score) || 0));
  const provided = new Map<string, number>();
  if (Array.isArray(value)) {
    value.forEach((item) => {
      const record = asRecord(item);
      const label = readString(record?.label);
      if (label) provided.set(label, normalizeScore(record?.score));
    });
  } else {
    const record = asRecord(value);
    if (record) {
      Object.entries(record).forEach(([label, score]) => provided.set(label, normalizeScore(asRecord(score)?.score ?? score)));
    }
  }
  return requiredLabels.map((label, index) => ({ label, score: provided.get(label) ?? fallbackEvaluationScore(totalScore, index) }));
}

function fallbackEvaluationScore(totalScore: number, index: number) {
  const offsets = [0, -8, 6, 3];
  return Math.max(0, Math.min(100, Math.round(totalScore + offsets[index])));
}

function normalizeStringList(value: unknown) {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return normalizeUnknownArray(value).map(readString).filter(Boolean);
}

function normalizeGoodFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = readString(value).toLowerCase();
  return ["true", "good", "well_written", "positive", "좋아요", "잘쓴표현", "잘 쓴 표현"].includes(text);
}

function normalizeUnknownArray(value: unknown) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  return record ? Object.values(record) : [];
}

function takeUniqueEdits(edits: Array<{ original: string; improved: string; reason: string; good: boolean }>, used: Set<string>, limit: number) {
  const unique: typeof edits = [];
  for (const edit of edits) {
    const key = edit.original.replace(/\s+/g, " ").trim();
    if (!key || used.has(key)) continue;
    used.add(key);
    unique.push(edit);
    if (unique.length >= limit) break;
  }
  return unique;
}

function ensureBalancedSentenceEdits(title: string, edits: Array<{ original: string; improved: string; reason: string; good: boolean }>, originalTextExcerpt: string, used: Set<string>) {
  const balanced = [...edits];
  if (balanced.length && !balanced.some((item) => !item.good)) {
    const needsEdit = makeFallbackEdit(title, originalTextExcerpt, used, false);
    if (needsEdit) balanced.push(needsEdit);
  }
  if (balanced.length && !balanced.some((item) => item.good)) {
    const goodEdit = makeFallbackEdit(title, originalTextExcerpt, used, true);
    if (goodEdit) balanced.push(goodEdit);
  }
  return balanced.slice(0, 5);
}

function formatExampleSuggestion(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^예\s*[:：]/.test(trimmed) ? trimmed : `예: ${trimmed}`;
}

function defaultSectionFeedback(title: string) {
  if (title === "지원동기") return "지원 직무에 대한 관심은 보이지만 회사와 직무를 선택한 구체적인 이유가 더 필요합니다.";
  if (title === "경험 서술") return "경험은 제시되어 있지만 맡은 역할, 행동, 성과가 한눈에 드러나도록 보완하면 좋습니다.";
  if (title === "입사 후 포부") return "성실하게 기여하려는 태도는 좋지만 입사 후 목표와 수행 계획을 더 구체화하면 좋습니다.";
  return "지원 직무와 자소서 내용의 연결을 더 선명하게 보여주면 좋습니다.";
}

function defaultSectionSuggestion(title: string) {
  if (title === "지원동기") return "예: 이 기관의 안전 관리 업무와 제 경험이 어떻게 연결되는지 한 문장으로 먼저 제시해 보세요.";
  if (title === "경험 서술") return "예: 어떤 업무를, 얼마나 자주, 어떤 결과로 수행했는지 숫자와 함께 작성해 보세요.";
  if (title === "입사 후 포부") return "예: 입사 후 3개월 안에 익힐 업무와 기여 방식을 구체적으로 써 보세요.";
  return "예: 공고의 자격요건과 연결되는 경험을 앞부분에 구체적으로 배치해 보세요.";
}

function makeSectionFallbackEdits(title: string, originalTextExcerpt: string, feedback: string, suggestion: string, used: Set<string>) {
  const needsEdit = makeFallbackEdit(title, originalTextExcerpt, used, false, suggestion || feedback);
  const goodEdit = makeFallbackEdit(title, originalTextExcerpt, used, true);
  return [needsEdit, goodEdit].filter(Boolean) as Array<{ original: string; improved: string; reason: string; good: boolean }>;
}

function makeFallbackEdit(title: string, originalTextExcerpt: string, used: Set<string>, good: boolean, reason = "") {
  const sentences = originalTextExcerpt
    .split(/\n|(?<=[.!?。])\s+/)
    .map((item) => item.replace(/^[-•\d.\s]+/, "").trim())
    .filter((item) => item.length >= 12);
  const patterns: Record<string, RegExp> = {
    "직무 연결성": /자격|직무|업무|공고|경력|전기|소방|기계|시설|관리|점검|분석|수행/,
    "지원동기": /지원|동기|관심|기관|회사|직무|선택|기여|공공|안전/,
    "경험 서술": /경험|프로젝트|성과|분석|작성|수행|담당|개선|결과|데이터|보고서|관리/,
    "입사 후 포부": /입사|기여|목표|계획|수행|역할|포부|노력|배우|성장/,
  };
  const candidates = [
    ...sentences.filter((item) => patterns[title]?.test(item)),
    ...sentences,
  ];
  const picked = candidates.find((item) => !used.has(item.replace(/\s+/g, " ").trim()));
  if (!picked) return null;
  const original = picked.slice(0, 180);
  used.add(picked.replace(/\s+/g, " ").trim());
  return {
    original,
    improved: good ? "이 표현은 지원자의 태도나 경험을 보여주므로 유지하되, 직무와의 연결을 한 문장 더 보강하면 좋습니다." : "",
    reason: reason || (good ? "지원자의 강점이 드러나는 표현입니다." : "공고와 연결되는 근거를 더 구체화할 수 있는 표현입니다."),
    good,
  };
}

function normalizeStatus(value: unknown): "good" | "needs_work" {
  return value === "good" || value === "좋아요" ? "good" : "needs_work";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function makeOriginalExcerpt(value = "") {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1000);
}

function limitStoredInput(value: string) {
  return value.trim().slice(0, 10000);
}

function assertCompleteAiFeedback(feedback: CoachingFeedback) {
  const requiredSections = ["지원동기", "경험 서술", "입사 후 포부"];
  const missingSectionEdit = requiredSections.some((title) => {
    const section = feedback.sections.find((item) => item.title === title);
    return !section?.sentenceEdits?.length;
  });
  if (!feedback.originalTextExcerpt?.trim() || !feedback.rewrittenText?.trim() || !feedback.jobConnection?.sentenceEdits?.length || missingSectionEdit) {
    throw new Error("Incomplete coaching feedback");
  }
}
