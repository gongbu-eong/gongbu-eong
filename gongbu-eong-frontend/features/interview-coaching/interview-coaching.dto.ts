export type NcsAreaName =
  | "의사소통능력"
  | "수리능력"
  | "문제해결능력"
  | "자기개발능력"
  | "대인관계능력"
  | "정보능력"
  | "직업윤리";

export type InterviewCoachingJob = {
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

export type InterviewAnswerFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextAnswerGuide: string;
  followUpQuestion: string | null;
  followUpNcsAreas?: NcsAreaName[];
};

export type InterviewMessage = {
  id: string;
  questionId: string | null;
  role: "question" | "answer" | "follow_up" | "system";
  content: string;
  followUpIndex: number | null;
  feedback: InterviewAnswerFeedback | null;
  createdAt: string;
};

export type InterviewCoachingStatus = "draft" | "ready" | "completed" | "failed";

export type InterviewCoachingResult = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionReviews: Array<{
    questionId: string;
    question: string;
    score: number;
    summary: string;
    strengths: string[];
    improvements: string[];
    ncsAreas: NcsAreaName[];
  }>;
  futurePracticeQuestions: string[];
};

export type InterviewCoachingSession = {
  id: string;
  status: InterviewCoachingStatus;
  lastErrorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  companyName: string;
  positionName: string;
  dutyText: string;
  job: InterviewCoachingJob | null;
  analysis: {
    profile: InterviewJobProfile;
    ncsMappings: InterviewNcsMapping[];
    questionPlan: string[];
  };
  questions: InterviewQuestion[];
  messages: InterviewMessage[];
  result: InterviewCoachingResult | null;
  isAnonymous: boolean;
};
