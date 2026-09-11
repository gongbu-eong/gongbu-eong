export type NcsAreaName =
  | "의사소통능력"
  | "수리능력"
  | "문제해결능력"
  | "자기개발능력"
  | "대인관계능력"
  | "정보능력"
  | "직업윤리";

export type InterviewCoachingJobDto = {
  id: string;
  institutionName: string;
  title: string;
  applicationEndAt: string | null;
  isManual?: boolean;
};

export type InterviewJobProfile = {
  companyName: string;
  positionName: string;
  dutyText: string;
  mainTasks: string[];
  requiredKnowledge: string[];
  preferredExperience: string[];
  keywords: string[];
};

export type InterviewNcsMapping = {
  name: NcsAreaName;
  relevance: number;
  reason: string;
  interviewFocus: string;
};

export type InterviewQuestion = {
  id: string;
  type: "experience" | "situation" | "job" | "personality" | "ethics";
  question: string;
  intent: string;
  ncsAreas: NcsAreaName[];
  difficulty: "기본" | "심화";
};

export type InterviewAnalysis = {
  profile: InterviewJobProfile;
  ncsMappings: InterviewNcsMapping[];
  questionPlan: string[];
};

export type InterviewMessageRole = "question" | "answer" | "follow_up";

export type InterviewCoachingStatus = "draft" | "ready" | "completed" | "failed";

export type InterviewMessage = {
  id: string;
  questionId: string | null;
  role: InterviewMessageRole;
  content: string;
  followUpIndex: number | null;
  feedback: InterviewAnswerFeedback | null;
  createdAt: string;
};

export type InterviewAnswerFeedback = {
  score?: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextAnswerGuide: string;
  followUpQuestion?: string | null;
  followUpNcsAreas?: NcsAreaName[];
};

export type InterviewQuestionReview = {
  questionId: string;
  question: string;
  score: number;
  answerScore: number;
  followUpScores: Array<{
    followUpIndex: number;
    score: number;
    summary: string;
  }>;
  summary: string;
  strengths: string[];
  improvements: string[];
  ncsAreas: NcsAreaName[];
};

export type InterviewCoachingResult = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionReviews: InterviewQuestionReview[];
  futurePracticeQuestions: string[];
};

export type InterviewCoachingSessionDto = {
  id: string;
  status: InterviewCoachingStatus;
  lastErrorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  companyName: string;
  positionName: string;
  dutyText: string;
  job: InterviewCoachingJobDto | null;
  analysis: InterviewAnalysis;
  questions: InterviewQuestion[];
  messages: InterviewMessage[];
  result: InterviewCoachingResult | null;
  isAnonymous?: boolean;
};
