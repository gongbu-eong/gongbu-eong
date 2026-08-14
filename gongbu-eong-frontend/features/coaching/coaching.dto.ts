export type CoachingGrade = "A+" | "A-" | "B+" | "B-" | "C+" | "C-" | "D+" | "D-" | "F";

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
};
export type CoachingSentenceEdit = { original: string; improved: string; reason: string; good?: boolean };
export type CoachingSection = { title: string; status?: "good" | "needs_work"; feedback: string; suggestion?: string; sentenceEdits?: CoachingSentenceEdit[]; example?: string };
export type CoachingJob = { id: string; institutionName: string; title: string; applicationEndAt: string | null };
export type CoachingHistoryItem = { id: string; requestId: string; createdAt: string; inputType: "text" | "file"; sourceFilename: string | null; inputText: string; job: CoachingJob | null; result: CoachingFeedback | null };
