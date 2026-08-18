export type CoachingInputType = "text" | "file";
export type CoachingGrade = "A+" | "A-" | "B+" | "B-" | "C+" | "C-" | "D+" | "D-" | "F";
export type CoachingFramework = "PREP" | "CAR" | "PAP" | "STAR";
export type CoachingReviewSeverity = "check" | "fix" | "keep";

export type CoachingQuestionInput = {
  question: string;
  characterLimit?: number | null;
};

export type CoachingQuestionReview = {
  question: string;
  answer: string;
  characterLimit: number | null;
  characterCount: number;
  exceededBy: number;
  frameworks: CoachingFramework[];
  editCount: number;
  methodComment: string;
  resumeEvidence: string[];
  highlights: Array<{
    original: string;
    severity: CoachingReviewSeverity;
    label: string;
    note: string;
  }>;
  edits: Array<{
    index: number;
    frameworkPart: string;
    severity: CoachingReviewSeverity;
    title: string;
    issue: string;
    suggestion: string;
    replacement?: string;
  }>;
};

export type CoachingSubmissionReview = {
  preSubmitChecks: number;
  fixSuggestions: number;
  keepCount: number;
  questions: CoachingQuestionReview[];
};

export type CoachingFeedback = {
  grade: CoachingGrade;
  score: number;
  summary: string;
  evaluationScores: Array<{ label: string; score: number }>;
  detailEvaluation: string[];
  originalTextExcerpt?: string;
  questionFeedback: Array<{ question: string; feedback: string; suggestion: string }>;
  jobConnection?: CoachingSection;
  improvementSuggestions: string[];
  sentenceEdits: Array<{ original: string; improved: string; reason: string; good?: boolean }>;
  sections: CoachingSection[];
  rewrittenText: string;
  submissionReview?: CoachingSubmissionReview;
};
export type CoachingSentenceEdit = { original: string; improved: string; reason: string; good?: boolean };
export type CoachingSection = { title: string; status?: "good" | "needs_work"; feedback: string; suggestion?: string; sentenceEdits?: CoachingSentenceEdit[]; example?: string };

export type CoachingJobDto = {
  id: string;
  institutionName: string;
  title: string;
  applicationEndAt: string | null;
};

export type CoachingHistoryDto = {
  id: string;
  requestId: string;
  createdAt: string;
  inputType: CoachingInputType;
  sourceFilename: string | null;
  inputText: string;
  job: CoachingJobDto | null;
  result: CoachingFeedback | null;
};
