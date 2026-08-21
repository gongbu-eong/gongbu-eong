import {
  CreateDiagnosisRunRequestDto,
  DiagnosisQuestionsResponseDto,
  DiagnosisResultDetailResponseDto,
  DiagnosisResultHistoryResponseDto,
  DiagnosisResultResponseDto,
  DiagnosisStatsResponseDto,
} from "./diagnosis.dto";
import type { DiagnosisTypeCode } from "./diagnosis.dto";
import {
  countDiagnosisResultHistory,
  countCompletedDiagnosisRuns,
  createDiagnosisRunWithResult,
  findActiveQuestionSet,
  findAnswerScores,
  findJobCategoriesForPersonalityType,
  findLatestDiagnosisResultForUser,
  findDiagnosisResultForUser,
  findDiagnosisResultById,
  findDiagnosisResultHistory,
  findDiagnosisPercentile,
  findSelectedDiagnosisResultId,
  selectDiagnosisResultForUser,
  countPreviousDiagnosisResults,
  findRecommendedInstitutions,
  findMonthlyHiringByPersonalityType,
  findPersonalityType,
  findQuestionsWithOptions,
} from "./diagnosis.repository";
import { recordDiagnosisCompleteEvent } from "@/domains/analytics/analytics.repository";
import { getJobPostings } from "../jobs/jobs.service";

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

const PERCENTILE_TRAIT_LABELS: Record<DiagnosisTypeCode, string> = {
  stability: "안정성",
  challenge: "도전성",
  teamwork: "협업성",
  individual: "독립 몰입도",
  execution: "실행력",
  planning: "기획력",
  principle: "정밀성",
  flexibility: "유연성",
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
      "한번 정한 일정과 루틴을 꾸준히 유지하는 힘이 있어 준비 과정이 쉽게 흔들리지 않습니다. 단기간에 무리해서 성과를 내기보다 해야 할 일을 일정하게 반복하면서 결과를 차곡차곡 쌓는 편입니다. 장기 프로젝트나 자격증 준비처럼 지속적인 관리가 필요한 상황에서 특히 강점을 발휘할 수 있습니다.",

      "이미 효과가 확인된 방법과 기준을 꾸준히 적용하면서 실수와 변수를 줄이는 데 강합니다. 일을 처리할 때 필요한 절차를 빠뜨리지 않고 차례대로 확인하기 때문에 결과의 편차가 크지 않은 편입니다. 같은 업무를 반복하더라도 조금씩 안정성과 완성도를 높여가는 능력이 강점으로 나타날 수 있습니다.",

      "마감과 약속, 정해진 기준을 중요하게 생각해 주변에서 믿고 일을 맡기기 좋은 사람으로 평가받기 쉽습니다. 맡은 일을 중간에 쉽게 포기하지 않고 책임 범위 안에서 끝까지 마무리하려는 성향이 강합니다. 특히 일정 준수와 지속적인 관리가 중요한 조직에서는 이러한 성향이 높은 신뢰로 이어질 수 있습니다.",
    ],

    growthPoint:
      "검증된 방법을 선호하는 성향이 강하면 새로운 방식이 필요한 상황에서도 기존 방법을 오래 유지하려 할 수 있습니다. 기존 방식 전체를 한꺼번에 바꾸기보다 위험이 적은 범위에서 새로운 방법을 하나씩 시험해보는 연습을 해보세요. 작은 실험을 반복하면서 성공한 방법을 자신의 기준에 추가하면 안정성을 유지하면서도 변화에 대응하는 힘을 키울 수 있습니다.",
  },

  challenge: {
    heroSummary: "새로운 기회와 변화 속에서 동기가 살아나는 편입니다.",
    personDescription:
      "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입이에요. 실패 가능성이 있어도 성장 가능성이 보이면 빠르게 움직이며 경험으로 방향을 잡습니다.",

    strengths: [
      "익숙하지 않은 과제나 새로운 환경을 만났을 때 지나치게 망설이기보다 직접 시도해보는 힘이 있습니다. 처음 해보는 일에서도 경험을 쌓으면서 빠르게 방법을 익히는 편이라 변화가 많은 상황에서 성장 속도가 빠를 수 있습니다. 새로운 전형이나 프로젝트처럼 정답이 명확하지 않은 상황에서도 적극적으로 가능성을 찾아가는 것이 강점입니다.",

      "목표가 높고 해결해야 할 문제가 어려울수록 오히려 집중력과 추진력이 살아나는 편입니다. 쉽게 달성할 수 있는 목표보다 도전적인 목표가 주어졌을 때 자신의 능력을 더 적극적으로 끌어내는 경향이 있습니다. 어려운 상황을 부담으로만 보기보다 성장할 수 있는 과제로 받아들이는 태도가 성과로 연결될 수 있습니다.",

      "예상하지 못한 변화가 생겼을 때 기존 계획이 틀어졌다는 사실에만 머물기보다 새로운 기회를 빠르게 찾습니다. 환경이 바뀌면 무엇을 새롭게 시도할 수 있는지 살펴보고 필요한 경우 방향을 과감하게 수정하는 편입니다. 변화가 빠른 업무나 새로운 사업, 개선 과제처럼 불확실성이 있는 환경에서 이러한 성향이 강점으로 작용합니다.",
    ],

    growthPoint:
      "새로운 기회를 빠르게 시도하는 것은 큰 장점이지만, 충분한 확인 없이 움직이면 시행착오가 필요 이상으로 커질 수 있습니다. 도전을 시작하기 전에 목표, 예상되는 위험, 반드시 확인해야 할 조건을 최소한으로 정리하는 습관을 만들어보세요. 빠른 실행력은 그대로 유지하면서도 시작 전에 몇 가지 기준만 확인하면 도전의 성공 가능성과 결과의 완성도를 함께 높일 수 있습니다.",
  },

  teamwork: {
    heroSummary: "사람들과 의견을 맞추며 함께 성과를 만드는 편입니다.",
    personDescription:
      "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입이에요. 협의와 피드백을 통해 안정적인 결론을 만들고 관계 안에서 성과를 냅니다.",

    strengths: [
      "서로 다른 의견이 나왔을 때 한쪽의 주장만 밀어붙이기보다 각자의 입장을 듣고 공통된 방향을 찾는 데 강합니다. 구성원이 어떤 역할을 맡으면 좋은지 살펴보고 업무를 자연스럽게 연결하는 능력도 발휘할 수 있습니다. 여러 사람이 함께 움직여야 하는 프로젝트에서는 이러한 조율 능력이 팀 전체의 진행 속도와 안정성을 높이는 데 도움이 됩니다.",

      "혼자 판단한 결과만 고집하기보다 다른 사람의 피드백을 받아 결과물을 개선하는 방식이 잘 맞습니다. 스터디, 리뷰, 회의처럼 서로 진행 상황을 점검하는 환경에서 새로운 아이디어나 부족한 부분을 빠르게 발견할 수 있습니다. 자신의 생각과 다른 의견도 활용할 수 있기 때문에 협업을 통해 개인 작업보다 더 완성도 높은 결과를 만들어낼 가능성이 높습니다.",

      "팀 안에서 정보가 끊기거나 역할이 연결되지 않는 부분을 발견하고 사람과 업무를 이어주는 데 강점이 있습니다. 필요한 내용을 공유하고 구성원 간의 상황을 확인하면서 공동 목표에서 벗어나지 않도록 흐름을 맞추는 편입니다. 부서 간 협업이나 여러 이해관계자가 함께 참여하는 업무에서 이러한 연결 능력이 특히 유용하게 활용될 수 있습니다.",
    ],

    growthPoint:
      "주변 의견을 충분히 듣고 조율하려는 성향이 강하면 결론을 내려야 하는 시점에서도 협의가 길어질 수 있습니다. 모든 사람이 완전히 동의할 때까지 기다리기보다 결정해야 할 시간과 본인이 책임져야 할 범위를 먼저 정해두는 것이 좋습니다. 충분히 의견을 들은 뒤에는 기준에 따라 결론을 내리고 실행하는 연습을 하면 협업 능력에 주도성까지 더할 수 있습니다.",
  },

  individual: {
    heroSummary: "혼자 집중해 판단하고 완성도를 끌어올리는 편입니다.",
    personDescription:
      "여러 사람과 계속 맞추기보다 스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입이에요. 독립적으로 기준을 세우고 깊게 파고들며, 방해가 적은 환경에서 집중력이 살아납니다.",

    strengths: [
      "혼자 충분히 집중할 수 있는 시간이 주어지면 업무의 흐름을 스스로 정리하고 안정적으로 처리하는 데 강합니다. 다른 사람의 지속적인 지시가 없어도 목표를 이해하면 필요한 작업을 스스로 찾아 진행하는 편입니다. 개인의 책임 범위가 명확하거나 높은 몰입이 필요한 업무에서 특히 좋은 성과를 낼 가능성이 있습니다.",

      "주변 사람의 의견이나 분위기에 쉽게 흔들리기보다 자신이 세운 기준을 바탕으로 판단하고 끝까지 밀고 가는 힘이 있습니다. 어려운 문제가 생겼을 때도 다른 사람이 해결해주기를 기다리기보다 스스로 자료와 방법을 찾아 해결하려는 성향이 강합니다. 독립적인 판단과 자기주도적인 업무 수행이 필요한 환경에서 이러한 특성이 장점으로 이어질 수 있습니다.",

      "하나의 문제를 깊게 살펴보고 세부적인 원인이나 구조를 파악하는 데 강합니다. 여러 업무를 짧게 반복하는 것보다 하나의 주제를 충분히 탐색하고 분석하면서 완성도를 높이는 방식이 잘 맞을 수 있습니다. 연구, 분석, 개발, 전문 업무처럼 깊은 사고와 집중이 필요한 분야에서 이러한 몰입력이 강한 경쟁력이 될 수 있습니다.",
    ],

    growthPoint:
      "스스로 판단하고 몰입하는 능력이 강한 만큼 자신의 관점 안에서 문제를 해결하려는 경향이 커질 수 있습니다. 특히 중요한 결정이나 여러 사람에게 영향을 주는 업무에서는 중간 단계에서 다른 사람의 의견을 짧게라도 확인해보세요. 독립적인 사고는 유지하면서 외부 피드백을 보완 자료로 활용하면 놓치고 있던 관점을 발견하고 결과의 완성도를 더욱 높일 수 있습니다.",
  },

  execution: {
    heroSummary: "고민보다 행동으로 먼저 흐름을 만드는 편입니다.",
    personDescription:
      "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입이에요. 해야 할 일이 보이면 빠르게 움직이고, 실행 과정에서 필요한 정보를 보완해갑니다.",

    strengths: [
      "해야 할 일이 보이면 오랫동안 고민하는 것보다 먼저 행동하면서 해결 방법을 찾는 힘이 있습니다. 처음부터 완벽한 방법을 찾지 못해도 가능한 부분부터 시작해 실제 경험을 통해 다음 방향을 결정하는 편입니다. 빠른 착수가 중요한 업무나 제한된 시간 안에 결과를 만들어야 하는 상황에서 강점이 크게 나타날 수 있습니다.",

      "해야 할 일을 뒤로 미루기보다 바로 행동으로 옮기는 성향이 강해 업무가 정체되는 것을 줄일 수 있습니다. 작은 업무라도 시작점을 빠르게 만들기 때문에 이후 필요한 사람이나 정보를 자연스럽게 연결하면서 진행 속도를 높이는 편입니다. 계획만 반복되고 실제 실행으로 이어지지 않는 상황에서 분위기를 행동 중심으로 전환시키는 역할을 할 수 있습니다.",

      "실행 과정에서 예상하지 못한 문제가 생겨도 계획이 틀어졌다는 이유로 멈추기보다 현재 상황에 맞게 행동을 조정합니다. 실제 현장에서 얻은 정보와 반응을 활용해 다음 행동을 빠르게 결정하는 편입니다. 고객 대응, 운영, 프로젝트 추진처럼 상황이 계속 변하면서 즉각적인 판단과 행동이 필요한 업무에 강점을 보일 수 있습니다.",
    ],

    growthPoint:
      "빠른 실행력은 분명한 장점이지만 속도를 우선하다 보면 처음에는 보이지 않았던 조건이나 작은 오류를 놓칠 가능성이 있습니다. 업무를 시작하기 전에 반드시 확인할 항목을 몇 가지로 줄여 간단한 체크리스트를 만들어보세요. 시작 속도를 늦추지 않는 범위에서 핵심 조건을 확인하고 완료 후 한 번 더 점검하는 습관을 들이면 실행력과 완성도를 동시에 높일 수 있습니다.",
  },

  planning: {
    heroSummary: "분석과 우선순위로 효율적인 길을 찾는 편입니다.",
    personDescription:
      "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입이에요. 정보를 비교하고 가능성을 분석해 우선순위를 세우며, 복잡한 상황을 구조화하는 데 강합니다.",

    strengths: [
      "업무를 시작하기 전에 목표와 필요한 단계를 정리해 전체 흐름을 파악하는 데 강합니다. 해야 할 일을 우선순위에 따라 나누고 일정이나 순서를 미리 결정하기 때문에 불필요하게 반복되는 작업을 줄일 수 있습니다. 여러 단계가 연결된 프로젝트나 장기간 진행되는 업무에서 안정적으로 진행 방향을 관리하는 능력이 강점이 됩니다.",

      "하나의 선택지만 바로 결정하기보다 여러 자료와 조건을 비교하면서 가능성이 높은 방법을 찾는 편입니다. 장점과 위험 요소를 함께 살펴보고 제한된 자원 안에서 어떤 선택이 가장 효율적인지 판단하려는 성향이 있습니다. 중요한 의사결정이나 여러 대안을 비교해야 하는 업무에서 이러한 분석적인 접근이 강점으로 작용할 수 있습니다.",

      "복잡하게 섞여 있는 정보에서도 중요한 기준을 찾아 분류하고 이해하기 쉬운 구조로 바꾸는 데 강합니다. 문제를 단계별로 나누고 각각 필요한 행동을 정리하기 때문에 막연했던 업무를 실제로 실행할 수 있는 계획으로 전환할 수 있습니다. 기획, 분석, 프로젝트 관리처럼 많은 정보를 정리하고 방향을 제시해야 하는 업무에서 이러한 구조화 능력이 유용합니다.",
    ],

    growthPoint:
      "더 좋은 방법을 찾기 위해 충분히 분석하려는 성향이 강하면 실제 행동을 시작하는 시점이 늦어질 수 있습니다. 모든 정보를 확인한 뒤 움직이기보다 현재 가진 정보로 결정해야 하는 마감 시점을 먼저 정해두는 것이 좋습니다. 분석 단계와 실행 단계를 명확하게 나누고 정해진 시간이 되면 작은 행동부터 시작하는 습관을 만들면 기획력과 실행력을 균형 있게 활용할 수 있습니다.",
  },

  principle: {
    heroSummary: "기준과 세부 사항을 꼼꼼히 확인하는 편입니다.",
    personDescription:
      "규칙과 원칙, 빠진 조건을 중요하게 보는 타입이에요. 작은 오류도 그냥 넘기지 않고 다시 확인하며, 정확성과 신뢰가 중요한 일에서 강점을 발휘합니다.",

    strengths: [
      "업무의 세부 조건과 누락된 부분을 꼼꼼하게 확인해 문제가 커지기 전에 발견하는 데 강합니다. 작은 오류라도 결과에 영향을 줄 수 있다고 판단하면 다시 한번 확인하고 수정하려는 성향이 있습니다. 계약, 데이터, 문서, 비용처럼 작은 실수가 큰 영향을 줄 수 있는 업무에서 리스크를 줄이는 중요한 역할을 할 수 있습니다.",

      "정해진 기준과 절차를 일관되게 적용해 결과의 정확성과 신뢰도를 유지하는 데 강점이 있습니다. 상황마다 처리 방식이 달라지는 것보다 일정한 기준으로 업무를 관리하려 하기 때문에 결과의 편차를 줄일 수 있습니다. 품질 관리나 운영 관리처럼 지속적으로 동일한 수준을 유지해야 하는 업무에서 신뢰할 수 있는 성과를 만들어낼 가능성이 높습니다.",

      "숫자와 문서, 절차처럼 세부적인 내용을 정확하게 확인해야 하는 업무에서 집중력이 잘 발휘됩니다. 필요한 정보를 하나씩 확인하면서 빠진 항목이나 서로 맞지 않는 내용을 발견하는 데 비교적 강한 편입니다. 회계, 행정, 품질, 데이터 관리처럼 정확성이 업무 결과에 직접 영향을 주는 환경에서 이러한 꼼꼼함이 큰 장점이 될 수 있습니다.",
    ],

    growthPoint:
      "정해진 원칙을 중요하게 생각하는 만큼 예상하지 못한 예외 상황에서는 판단에 시간이 걸리거나 기존 절차를 지나치게 고수할 수 있습니다. 반드시 지켜야 하는 핵심 기준과 상황에 따라 조정할 수 있는 기준을 미리 구분해두는 연습을 해보세요. 원칙을 포기하는 것이 아니라 원칙의 목적을 지키면서 선택할 수 있는 대안을 함께 준비하면 정확성과 유연성을 동시에 높일 수 있습니다.",
  },

  flexibility: {
    heroSummary: "상황 변화에 맞춰 현실적인 대안을 찾는 편입니다.",
    personDescription:
      "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입이에요. 기존 기준에만 묶이지 않고 상황을 읽으며 현실적인 선택지를 조정합니다.",

    strengths: [
      "처음 예상했던 상황과 다르게 일이 진행되어도 당황해서 멈추기보다 현재 사용할 수 있는 방법을 빠르게 찾는 편입니다. 기존 계획이 어려워지면 목표를 포기하기보다 다른 방법으로 결과를 만들 수 있는지를 살펴봅니다. 갑작스러운 일정 변경이나 새로운 요구사항이 자주 발생하는 환경에서 이러한 대응력이 강점으로 작용할 수 있습니다.",

      "기존 방식이 현재 상황에 맞지 않는다고 판단하면 방법을 그대로 고집하기보다 현실적인 조건에 맞춰 조정할 수 있습니다. 사람, 시간, 비용, 자원처럼 현재 사용할 수 있는 조건을 고려해 가장 실현 가능한 방법을 선택하려는 성향이 있습니다. 정해진 답이 없는 문제나 제한된 자원 안에서 대안을 만들어야 하는 상황에서 좋은 해결책을 찾을 가능성이 높습니다.",

      "새로운 사람이나 환경, 업무 방식에 비교적 빠르게 적응하면서 필요한 행동 방식을 바꾸는 데 강합니다. 변화 자체에 오래 머무르기보다 현재 상황에서 무엇을 할 수 있는지를 먼저 살펴보기 때문에 업무 흐름이 끊기는 것을 줄일 수 있습니다. 고객 대응이나 운영, 다양한 이해관계자와 함께하는 업무처럼 변화가 많은 환경에서 적응력과 대응력이 효과적으로 발휘될 수 있습니다.",
    ],

    growthPoint:
      "상황에 맞춰 빠르게 방법을 바꾸는 것은 장점이지만 변화가 반복되면 주변에서는 기준이 자주 달라진다고 느낄 수도 있습니다. 방법은 유연하게 바꾸더라도 품질, 일정, 목표처럼 반드시 지켜야 할 핵심 기준을 2~3개 정도 정해두세요. 변하지 않는 기준을 중심에 두고 상황에 따라 실행 방법만 조정하면 유연성을 유지하면서도 결과의 일관성과 신뢰도를 높일 수 있습니다.",
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

export async function getLatestDiagnosisResult(
  userId: string,
): Promise<DiagnosisResultResponseDto | null> {
  const result = await findLatestDiagnosisResultForUser(userId);

  if (!result) {
    return null;
  }

  return toDiagnosisResultResponse(result);
}

export async function getDiagnosisResultDetail(
  userId: string | null,
  resultId?: string,
): Promise<DiagnosisResultDetailResponseDto | null> {
  if (!userId && !resultId) {
    return null;
  }

  let isOwner = true;
  const result = resultId
    ? userId
      ? await findDiagnosisResultForUser(userId, resultId)
      : null
    : await findLatestDiagnosisResultForUser(userId!);
  const publicResult = resultId && !result
    ? await findDiagnosisResultById(resultId)
    : null;
  const resolvedResult = result || publicResult;

  if (!result && publicResult) {
    isOwner = false;
  }

  if (!resolvedResult) {
    return null;
  }

  const [response, percentile, previousResultCount, companies, monthlyHiring, recommendedJobs] =
    await Promise.all([
      toDiagnosisResultResponse(resolvedResult),
      isOwner && userId
        ? findDiagnosisPercentile(resolvedResult.result_id, resolvedResult.type_code, userId)
        : Promise.resolve({ topPercent: null, sampleSize: 0 }),
      isOwner && userId
        ? countPreviousDiagnosisResults(userId, resolvedResult.result_id)
        : Promise.resolve(0),
      findRecommendedInstitutions(resolvedResult.type_code, 3),
      findMonthlyHiringByPersonalityType(resolvedResult.type_code),
      isOwner && userId
        ? getJobPostings({
            view: "recommended",
            userId,
            diagnosisResultId: resolvedResult.result_id,
            monthlyRegularOnly: true,
            limit: 3,
            offset: 0,
          })
        : Promise.resolve({ items: [] }),
    ]);

  return {
    result: response,
    completedAt: new Date(resolvedResult.completed_at).toISOString(),
    isOwner,
    percentile: {
      traitLabel: PERCENTILE_TRAIT_LABELS[resolvedResult.type_code],
      topPercent: percentile.topPercent,
      sampleSize: percentile.sampleSize,
    },
    previousResultCount,
    companies,
    recommendedPostings: recommendedJobs.items.map((posting) => ({
      id: posting.id,
      institutionName: posting.institutionName,
      title: posting.title,
      applicationEndAt: posting.applicationEndAt,
      dday: posting.dday,
      employmentType: posting.employmentType,
      region: posting.region,
      careerRequirement: posting.careerRequirement,
      categories: posting.categories,
    })),
    monthlyHiring: {
      month: new Date().getMonth() + 1,
      totalCount: monthlyHiring.totalCount,
      primaryCategory:
        response.jobCategories[0]?.name ||
        monthlyHiring.categories[0]?.name ||
        "",
      categories: monthlyHiring.categories,
    },
  };
}

export async function getDiagnosisResultHistory(args: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<DiagnosisResultHistoryResponseDto> {
  const limit = Math.max(1, Math.min(args.limit || 10, 30));
  const [rows, totalCount, selectedResultId] = await Promise.all([
    findDiagnosisResultHistory({
      userId: args.userId,
      cursor: args.cursor,
      limit: limit + 1,
    }),
    countDiagnosisResultHistory(args.userId),
    findSelectedDiagnosisResultId(args.userId),
  ]);
  const hasNext = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items: items.map((row) => ({
      resultId: row.result_id,
      runId: row.run_id,
      typeCode: row.type_code,
      typeName: row.type_name,
      completedAt: new Date(row.completed_at).toISOString(),
      isSelected: row.is_selected,
    })),
    nextCursor: hasNext ? items.at(-1)?.result_id || null : null,
    totalCount,
    selectedResultId,
  };
}

export async function setSelectedDiagnosisResult(args: {
  userId: string;
  resultId: string;
}) {
  const selected = await selectDiagnosisResultForUser(args.userId, args.resultId);

  return Boolean(selected);
}

async function toDiagnosisResultResponse(
  result: Awaited<ReturnType<typeof findLatestDiagnosisResultForUser>>,
): Promise<DiagnosisResultResponseDto> {
  if (!result) {
    throw new Error("Diagnosis result was not found.");
  }

  const axisScores: AxisScores = {
    stability: result.stability_axis_percent,
    teamwork: result.teamwork_axis_percent,
    execution: result.execution_axis_percent,
    principle: result.principle_axis_percent,
  };
  const traitScores = toTraitScores(axisScores);
  const jobCategories = await findJobCategoriesForPersonalityType(
    result.type_code,
  );

  return {
    runId: result.run_id,
    resultId: result.result_id,
    attemptNo: null,
    typeCode: result.type_code,
    typeName: result.type_name,
    summary: result.summary || "",
    scores: traitScores,
    percentages: traitScores,
    axisResults: toAxisResults(axisScores),
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    growthPoints: Array.isArray(result.weaknesses) ? result.weaknesses : [],
    recommendations: [],
    jobCategories,
  };
}

export async function submitDiagnosis(args: {
  body: CreateDiagnosisRunRequestDto;
  userId?: string;
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
    userId: args.userId,
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
  const diagnosisCompleteEvent = await recordDiagnosisCompleteEvent({
    userId: args.userId,
    anonymousId: args.body.anonymousId,
    diagnosisRunId: created.runId,
    diagnosisResultId: created.resultId,
    diagnosisType: typeCode,
    attribution: args.body.attribution,
    properties: {
      type_name: personalityType.name,
      question_set_id: questionSet.id,
      total_score: totalScore,
    },
  });

  return {
    runId: created.runId,
    resultId: created.resultId,
    attemptNo: diagnosisCompleteEvent.attemptNo,
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
