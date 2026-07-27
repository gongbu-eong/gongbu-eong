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

export type CreateDiagnosisRunRequestDto = {
  anonymousId?: string;
  entrySource?: string;
  answers: DiagnosisAnswerRequestDto[];
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
