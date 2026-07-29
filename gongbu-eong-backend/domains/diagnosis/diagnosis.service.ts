import {
  CreateDiagnosisRunRequestDto,
  DiagnosisQuestionsResponseDto,
  DiagnosisResultResponseDto,
  DiagnosisStatsResponseDto,
} from "./diagnosis.dto";
import type { DiagnosisTypeCode } from "./diagnosis.dto";
import {
  countCompletedDiagnosisRuns,
  createDiagnosisRunWithResult,
  findActiveQuestionSet,
  findAnswerScores,
  findJobCategoriesForPersonalityType,
  findPersonalityType,
  findQuestionsWithOptions,
} from "./diagnosis.repository";

type AxisCode = "stability" | "teamwork" | "execution" | "principle";
type OptionNo = 1 | 2 | 3 | 4 | 5;
type AxisScores = Record<AxisCode, number>;
type TraitScores = Record<DiagnosisTypeCode, number>;
type VocationalFitCode = "R" | "I" | "A" | "S" | "E" | "C";
type VocationalFitScores = Record<VocationalFitCode, number>;

type AxisDefinition = {
  code: AxisCode;
  leftCode: DiagnosisTypeCode;
  rightCode: DiagnosisTypeCode;
  leftLabel: string;
  rightLabel: string;
};

type ResultCopy = {
  heroSummary: string;
  personDescription: string;
  strengths: [string, string, string];
  growthPoint: string;
};

const EXPECTED_ANSWER_COUNT = 16;
const TYPE_TIE_BREAK_ORDER: DiagnosisTypeCode[] = [
  "stability",
  "challenge",
  "teamwork",
  "individual",
  "execution",
  "planning",
  "principle",
  "flexibility",
];

const STRAIGHT_LINE_TIE_BREAK: Record<OptionNo, DiagnosisTypeCode> = {
  1: "challenge",
  2: "individual",
  3: "stability",
  4: "execution",
  5: "principle",
};

const AXIS_DEFINITIONS: Record<AxisCode, AxisDefinition> = {
  stability: {
    code: "stability",
    leftCode: "stability",
    rightCode: "challenge",
    leftLabel: "안정지향",
    rightLabel: "도전",
  },
  teamwork: {
    code: "teamwork",
    leftCode: "teamwork",
    rightCode: "individual",
    leftLabel: "팀 협업",
    rightLabel: "개인",
  },
  execution: {
    code: "execution",
    leftCode: "execution",
    rightCode: "planning",
    leftLabel: "실행력",
    rightLabel: "기획",
  },
  principle: {
    code: "principle",
    leftCode: "principle",
    rightCode: "flexibility",
    leftLabel: "원칙·꼼꼼함",
    rightLabel: "유연",
  },
};

const EMPTY_AXIS_TOTALS: Record<AxisCode, { total: number; count: number }> = {
  stability: { total: 0, count: 0 },
  teamwork: { total: 0, count: 0 },
  execution: { total: 0, count: 0 },
  principle: { total: 0, count: 0 },
};

const RESULT_COPIES: Record<DiagnosisTypeCode, ResultCopy> = {
  stability: {
    heroSummary: "예측 가능한 환경에서 꾸준히 성과를 쌓는 편입니다.",
    personDescription:
      "정해진 기준과 절차가 명확할 때 집중력이 살아나는 타입이에요. 계획을 꾸준히 지키고, 갑작스러운 변화보다 검증된 방식으로 안정적인 결과를 만드는 데 강합니다.",
    strengths: [
      "일정과 루틴을 안정적으로 유지해 준비 과정이 쉽게 흔들리지 않습니다.",
      "검증된 방법을 꾸준히 반복하며 실수를 줄이는 힘이 있습니다.",
      "마감과 기준을 놓치지 않아 신뢰를 쌓기 좋습니다.",
    ],
    growthPoint:
      "검증된 방식 안에서도 작은 실험을 하나씩 넣어보면 변화 대응력이 좋아집니다.",
  },
  challenge: {
    heroSummary: "새로운 기회와 변화 속에서 동기가 살아나는 편입니다.",
    personDescription:
      "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입이에요. 실패 가능성이 있어도 성장 가능성이 보이면 빠르게 움직이며 경험으로 방향을 잡습니다.",
    strengths: [
      "새로운 전형이나 낯선 과제에도 시도 속도가 빠릅니다.",
      "높은 목표가 있을 때 집중력과 추진력이 살아납니다.",
      "변화가 생겨도 기회 요소를 빠르게 찾아냅니다.",
    ],
    growthPoint:
      "도전 전에 최소 확인 기준을 정해두면 시행착오를 줄이면서 속도를 유지할 수 있습니다.",
  },
  teamwork: {
    heroSummary: "사람들과 의견을 맞추며 함께 성과를 만드는 편입니다.",
    personDescription:
      "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입이에요. 협의와 피드백을 통해 안정적인 결론을 만들고 관계 안에서 성과를 냅니다.",
    strengths: [
      "의견을 조율하고 역할을 나누는 과정에서 강점이 드러납니다.",
      "스터디나 피드백처럼 함께 점검하는 방식이 잘 맞습니다.",
      "조직 안에서 필요한 연결과 협업 흐름을 잘 만들어냅니다.",
    ],
    growthPoint:
      "협의가 길어질 때는 본인이 책임질 결론과 마감 기준을 먼저 정해보세요.",
  },
  individual: {
    heroSummary: "혼자 집중해 판단하고 완성도를 끌어올리는 편입니다.",
    personDescription:
      "여러 사람과 계속 맞추기보다 스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입이에요. 독립적으로 기준을 세우고 깊게 파고들며, 방해가 적은 환경에서 집중력이 살아납니다.",
    strengths: [
      "혼자 집중하는 시간이 주어지면 판단과 처리 속도가 안정됩니다.",
      "타인의 흐름에 휩쓸리지 않고 자기 기준으로 끝까지 밀고 갑니다.",
      "깊이 있는 검토나 독립적인 분석 업무에 강합니다.",
    ],
    growthPoint:
      "중요한 결정 전에는 짧게라도 외부 피드백을 받아 관점의 빈틈을 줄여보세요.",
  },
  execution: {
    heroSummary: "고민보다 행동으로 먼저 흐름을 만드는 편입니다.",
    personDescription:
      "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입이에요. 해야 할 일이 보이면 빠르게 움직이고, 실행 과정에서 필요한 정보를 보완해갑니다.",
    strengths: [
      "시작이 빠르고 실행 과정에서 감을 잡는 힘이 있습니다.",
      "해야 할 일이 생겼을 때 미루지 않고 행동으로 옮깁니다.",
      "현장 변화에 맞춰 움직이며 결과를 만들어내는 속도가 좋습니다.",
    ],
    growthPoint:
      "바로 시작하되 체크리스트 하나를 곁들이면 속도와 완성도를 함께 챙길 수 있습니다.",
  },
  planning: {
    heroSummary: "분석과 우선순위로 효율적인 길을 찾는 편입니다.",
    personDescription:
      "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입이에요. 정보를 비교하고 가능성을 분석해 우선순위를 세우며, 복잡한 상황을 구조화하는 데 강합니다.",
    strengths: [
      "목표와 순서를 정리해 불필요한 시행착오를 줄입니다.",
      "자료를 비교하고 가능성을 분석해 합리적인 선택을 합니다.",
      "복잡한 정보를 구조화해 실행 가능한 계획으로 바꿉니다.",
    ],
    growthPoint:
      "분석 시간이 길어질 때는 실행 마감일을 먼저 정해 계획이 행동으로 이어지게 해보세요.",
  },
  principle: {
    heroSummary: "기준과 세부 사항을 꼼꼼히 확인하는 편입니다.",
    personDescription:
      "규칙과 원칙, 빠진 조건을 중요하게 보는 타입이에요. 작은 오류도 그냥 넘기지 않고 다시 확인하며, 정확성과 신뢰가 중요한 일에서 강점을 발휘합니다.",
    strengths: [
      "세부 조건과 오류를 꼼꼼히 확인해 리스크를 줄입니다.",
      "정해진 기준을 정확히 지켜 결과의 신뢰도를 높입니다.",
      "문서, 숫자, 절차처럼 정확성이 중요한 업무에 강합니다.",
    ],
    growthPoint:
      "원칙을 지키되 예외 상황에서 선택할 대안 기준을 함께 세워두면 유연성이 좋아집니다.",
  },
  flexibility: {
    heroSummary: "상황 변화에 맞춰 현실적인 대안을 찾는 편입니다.",
    personDescription:
      "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입이에요. 기존 기준에만 묶이지 않고 상황을 읽으며 현실적인 선택지를 조정합니다.",
    strengths: [
      "예상 밖 상황에서도 대안을 빠르게 찾아 흐름을 이어갑니다.",
      "기존 방식이 맞지 않으면 현실에 맞게 기준을 조정합니다.",
      "변화가 많은 환경에서 적응력과 대응력이 살아납니다.",
    ],
    growthPoint:
      "유연하게 바꾸더라도 반드시 지킬 기준 2~3개를 고정하면 결과가 더 안정됩니다.",
  },
};

export async function getDiagnosisQuestions(): Promise<DiagnosisQuestionsResponseDto> {
  const questionSet = await findActiveQuestionSet();

  if (!questionSet) {
    throw new Error("Active diagnosis question set was not found.");
  }

  const rows = await findQuestionsWithOptions(questionSet.id);
  const questions = rows.reduce<DiagnosisQuestionsResponseDto["questions"]>(
    (items, row) => {
      let question = items.find((item) => item.id === row.question_id);

      if (!question) {
        question = {
          id: row.question_id,
          questionNo: row.question_no,
          questionText: row.question_text,
          traitKey: row.trait_key,
          options: [],
        };
        items.push(question);
      }

      question.options.push({
        id: row.option_id,
        optionNo: row.option_no,
        optionText: row.option_text,
        score: row.score,
      });

      return items;
    },
    [],
  );

  return {
    questionSetId: questionSet.id,
    title: questionSet.title,
    version: questionSet.version,
    questions,
  };
}

export async function getDiagnosisStats(): Promise<DiagnosisStatsResponseDto> {
  return {
    participantCount: await countCompletedDiagnosisRuns(),
  };
}

export async function submitDiagnosis(args: {
  body: CreateDiagnosisRunRequestDto;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
}): Promise<DiagnosisResultResponseDto> {
  if (args.body.answers.length !== EXPECTED_ANSWER_COUNT) {
    throw new Error(`Exactly ${EXPECTED_ANSWER_COUNT} answers are required.`);
  }

  const [questionSet, answerScores] = await Promise.all([
    findActiveQuestionSet(),
    findAnswerScores(args.body.answers),
  ]);

  if (!questionSet) {
    throw new Error("Active diagnosis question set was not found.");
  }

  if (answerScores.length !== args.body.answers.length) {
    throw new Error("Some answers are invalid.");
  }

  const axisTotals = answerScores.reduce(
    (acc, answer) => {
      const axisCode = toAxisCode(answer.trait_key);

      if (!axisCode) {
        return acc;
      }

      acc[axisCode].total += toLeftAxisPercent(answer.score as OptionNo);
      acc[axisCode].count += 1;

      return acc;
    },
    cloneAxisTotals(),
  );

  const axisScores = toAxisScores(axisTotals);
  const traitScores = toTraitScores(axisScores);
  const vocationalFitScores = toVocationalFitScores(traitScores);
  const axisResults = toAxisResults(axisScores);
  const typeCode = resolveTypeCode(
    traitScores,
    vocationalFitScores,
    answerScores.map((answer) => answer.raw_score as OptionNo),
  );
  const personalityType = await findPersonalityType(typeCode);

  if (!personalityType) {
    throw new Error("Personality type was not found.");
  }

  const resultCopy = getResultCopy(typeCode);
  const jobCategories = await findJobCategoriesForPersonalityType(typeCode);
  const totalScore = Math.round(traitScores[typeCode]);
  const created = await createDiagnosisRunWithResult({
    questionSetId: questionSet.id,
    anonymousId: args.body.anonymousId,
    entrySource: args.body.entrySource || "diagnosis",
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
    referer: args.referer,
    answers: answerScores.map((answer) => ({
      questionId: answer.question_id,
      optionId: answer.option_id,
      score: answer.raw_score,
    })),
    personalityTypeId: personalityType.id,
    typeCode,
    totalScore,
    stabilityScore: traitScores.stability,
    challengeScore: traitScores.challenge,
    analyticalScore: traitScores.planning,
    axisScores,
    summary: personalityType.summary,
    strengths: resultCopy.strengths,
    weaknesses: [resultCopy.growthPoint],
    rawResult: {
      axisScores,
      axisResults,
      traitScores,
      vocationalFitScores,
      typeCode,
      scoring: {
        mode: "ipsative",
        description:
          "각 축의 기준 성향 문항 4개를 10~90%로 보정하고, 반대 성향은 100에서 기준 성향 점수를 뺀 값으로 산출합니다.",
        scale: {
          minPercent: 10,
          maxPercent: 90,
          optionScoreMap: {
            1: 10,
            2: 30,
            3: 50,
            4: 70,
            5: 90,
          },
        },
        normTableRequired: false,
        normTableNote:
          "학교급·성별 규준표는 표준화 심리검사의 집단 대비 위치 산출에 필요하지만, 이 진단은 집단 평균과 비교하지 않습니다.",
      },
    },
  });

  return {
    runId: created.runId,
    resultId: created.resultId,
    typeCode,
    typeName: personalityType.name,
    summary: personalityType.summary,
    scores: traitScores,
    percentages: traitScores,
    axisResults,
    strengths: resultCopy.strengths,
    growthPoints: [resultCopy.growthPoint],
    recommendations: [],
    jobCategories,
  };
}

function resolveTypeCode(
  traitScores: TraitScores,
  vocationalFitScores: VocationalFitScores,
  rawScores: OptionNo[],
): DiagnosisTypeCode {
  const straightLineType = resolveStraightLineType(rawScores);

  if (straightLineType) {
    return straightLineType;
  }

  const entries = Object.entries(traitScores) as [DiagnosisTypeCode, number][];

  const sorted = entries.sort(
    (a, b) =>
      b[1] - a[1] ||
      getTieBreakerScore(b[0], vocationalFitScores) -
        getTieBreakerScore(a[0], vocationalFitScores) ||
      getTypePriority(a[0], rawScores) - getTypePriority(b[0], rawScores),
  );

  return sorted[0][0];
}

function resolveStraightLineType(rawScores: OptionNo[]) {
  if (rawScores.length === 0) {
    return null;
  }

  const uniqueScore = new Set(rawScores);

  if (uniqueScore.size !== 1) {
    return null;
  }

  return STRAIGHT_LINE_TIE_BREAK[rawScores[0]];
}

function getTypePriority(typeCode: DiagnosisTypeCode, rawScores: OptionNo[]) {
  const order = getContextualTieBreakOrder(rawScores);
  const index = order.indexOf(typeCode);
  return index === -1 ? order.length : index;
}

function getContextualTieBreakOrder(rawScores: OptionNo[]) {
  const averageRawScore =
    rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length;

  if (averageRawScore < 3) {
    return [
      "challenge",
      "individual",
      "flexibility",
      "planning",
      "execution",
      "teamwork",
      "principle",
      "stability",
    ] satisfies DiagnosisTypeCode[];
  }

  if (averageRawScore > 3) {
    return [
      "principle",
      "execution",
      "teamwork",
      "stability",
      "challenge",
      "individual",
      "planning",
      "flexibility",
    ] satisfies DiagnosisTypeCode[];
  }

  return TYPE_TIE_BREAK_ORDER;
}

function getTieBreakerScore(
  typeCode: DiagnosisTypeCode,
  vocationalFitScores: VocationalFitScores,
) {
  const primaryFitCodes: Record<DiagnosisTypeCode, VocationalFitCode[]> = {
    stability: ["C", "S"],
    challenge: ["E", "A"],
    teamwork: ["S", "E"],
    individual: ["I", "R"],
    execution: ["R", "E"],
    planning: ["I", "C"],
    principle: ["C", "I"],
    flexibility: ["A", "E"],
  };

  return primaryFitCodes[typeCode].reduce(
    (sum, code) => sum + vocationalFitScores[code],
    0,
  );
}

function cloneAxisTotals() {
  return {
    stability: { ...EMPTY_AXIS_TOTALS.stability },
    teamwork: { ...EMPTY_AXIS_TOTALS.teamwork },
    execution: { ...EMPTY_AXIS_TOTALS.execution },
    principle: { ...EMPTY_AXIS_TOTALS.principle },
  };
}

function toAxisCode(traitKey: string): AxisCode | null {
  if (traitKey === "stability_axis") {
    return "stability";
  }

  if (traitKey === "teamwork_axis") {
    return "teamwork";
  }

  if (traitKey === "execution_axis") {
    return "execution";
  }

  if (traitKey === "principle_axis") {
    return "principle";
  }

  return null;
}

function toLeftAxisPercent(optionNo: OptionNo) {
  return Math.round(10 + ((optionNo - 1) / 4) * 80);
}

function toAxisScores(axisTotals: Record<AxisCode, { total: number; count: number }>): AxisScores {
  return {
    stability: averageAxis(axisTotals.stability),
    teamwork: averageAxis(axisTotals.teamwork),
    execution: averageAxis(axisTotals.execution),
    principle: averageAxis(axisTotals.principle),
  };
}

function averageAxis(axis: { total: number; count: number }) {
  return axis.count === 0 ? 50 : Math.round(axis.total / axis.count);
}

function toTraitScores(axisScores: AxisScores): TraitScores {
  return {
    stability: axisScores.stability,
    challenge: 100 - axisScores.stability,
    teamwork: axisScores.teamwork,
    individual: 100 - axisScores.teamwork,
    execution: axisScores.execution,
    planning: 100 - axisScores.execution,
    principle: axisScores.principle,
    flexibility: 100 - axisScores.principle,
  };
}

function toVocationalFitScores(scores: TraitScores): VocationalFitScores {
  return {
    R: weightedAverage([
      [scores.execution, 0.3],
      [scores.principle, 0.2],
      [scores.individual, 0.15],
      [scores.challenge, 0.15],
      [scores.planning, 0.1],
      [scores.flexibility, 0.1],
    ]),
    I: weightedAverage([
      [scores.planning, 0.3],
      [scores.principle, 0.25],
      [scores.individual, 0.15],
      [scores.stability, 0.15],
      [scores.challenge, 0.1],
      [scores.execution, 0.05],
    ]),
    A: weightedAverage([
      [scores.flexibility, 0.35],
      [scores.challenge, 0.25],
      [scores.individual, 0.15],
      [scores.planning, 0.1],
      [scores.teamwork, 0.1],
      [scores.execution, 0.05],
    ]),
    S: weightedAverage([
      [scores.teamwork, 0.35],
      [scores.stability, 0.2],
      [scores.flexibility, 0.15],
      [scores.principle, 0.1],
      [scores.execution, 0.1],
      [scores.planning, 0.1],
    ]),
    E: weightedAverage([
      [scores.challenge, 0.3],
      [scores.execution, 0.25],
      [scores.teamwork, 0.15],
      [scores.flexibility, 0.15],
      [scores.individual, 0.1],
      [scores.planning, 0.05],
    ]),
    C: weightedAverage([
      [scores.principle, 0.35],
      [scores.stability, 0.25],
      [scores.planning, 0.2],
      [scores.teamwork, 0.1],
      [scores.execution, 0.1],
    ]),
  };
}

function weightedAverage(items: [number, number][]) {
  return Math.round(items.reduce((sum, [score, weight]) => sum + score * weight, 0));
}

function toAxisResults(axisScores: AxisScores) {
  return (Object.keys(AXIS_DEFINITIONS) as AxisCode[]).map((code) => {
    const definition = AXIS_DEFINITIONS[code];
    const percent = axisScores[code];

    return {
      code,
      leftLabel: definition.leftLabel,
      rightLabel: definition.rightLabel,
      percent,
      dominantLabel:
        percent > 55 ? definition.leftLabel : percent < 45 ? definition.rightLabel : "균형",
    };
  });
}

function getResultCopy(typeCode: DiagnosisTypeCode) {
  return RESULT_COPIES[typeCode];
}
