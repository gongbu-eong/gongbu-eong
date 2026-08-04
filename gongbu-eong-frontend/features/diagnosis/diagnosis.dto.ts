export type DiagnosisQuestionOptionDto = {
  id: string;
  optionNo: number;
  optionText: string;
  score: number;
};

export type DiagnosisQuestionDto = {
  id: string;
  questionNo: number;
  questionText: string;
  traitKey: string;
  options: DiagnosisQuestionOptionDto[];
};

export type DiagnosisQuestionsResponseDto = {
  questionSetId: string;
  title: string;
  version: number;
  questions: DiagnosisQuestionDto[];
};

export type DiagnosisStatsResponseDto = {
  participantCount: number;
};

export type DiagnosisAnswerRequestDto = {
  questionId: string;
  optionId: string;
};

export type DiagnosisTypeCode =
  | "stability"
  | "challenge"
  | "teamwork"
  | "individual"
  | "execution"
  | "planning"
  | "principle"
  | "flexibility";

export type DiagnosisResultResponseDto = {
  runId: string;
  resultId: string;
  typeCode: DiagnosisTypeCode;
  typeName: string;
  summary: string;
  scores: Record<DiagnosisTypeCode, number>;
  percentages: Record<DiagnosisTypeCode, number>;
  axisResults: {
    code: "stability" | "teamwork" | "execution" | "principle";
    leftLabel: string;
    rightLabel: string;
    percent: number;
    dominantLabel: string;
  }[];
  strengths: string[];
  growthPoints: string[];
  recommendations: string[];
  jobCategories: {
    name: string;
    reason: string;
  }[];
};

export type DiagnosisResultHistoryItemDto = {
  resultId: string;
  runId: string;
  typeCode: DiagnosisTypeCode;
  typeName: string;
  completedAt: string;
};

export type DiagnosisResultHistoryResponseDto = {
  items: DiagnosisResultHistoryItemDto[];
  nextCursor: string | null;
};

export type DiagnosisResultDetailResponseDto = {
  result: DiagnosisResultResponseDto;
  completedAt: string;
  percentile: {
    traitLabel: string;
    topPercent: number | null;
    sampleSize: number;
  };
  previousResultCount: number;
  companies: {
    id: string;
    name: string;
  }[];
  recommendedPostings: {
    id: string;
    institutionName: string;
    title: string;
    applicationEndAt: string | null;
    dday: string;
    employmentType: string | null;
    region: string | null;
    careerRequirement: string | null;
    categories: string[];
  }[];
  monthlyHiring: {
    month: number;
    totalCount: number;
    primaryCategory: string;
    categories: {
      name: string;
      count: number;
    }[];
  };
};
