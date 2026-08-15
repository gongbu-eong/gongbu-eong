export type CurrentUserDto = {
  id: string;
  email: string | null;
  nickname: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  communityNickname: string | null;
  profileStatusMessage: string | null;
  profileAvatarKey: string | null;
  profileBackgroundColor: string | null;
  gender: string | null;
  ageGroup: string | null;
  provider: "kakao" | "naver" | null;
  diagnosisTypeCode:
    | "stability"
    | "challenge"
    | "teamwork"
    | "individual"
    | "execution"
    | "planning"
    | "principle"
    | "flexibility"
    | null;
  diagnosisTypeName: string | null;
  diagnosisRunId: string | null;
  diagnosisResultId: string | null;
  creditBalance?: number;
  unreadNotificationCount?: number;
};

export type CurrentUserResponseDto = {
  ok: boolean;
  authenticated: boolean;
  user: CurrentUserDto | null;
};

export type JobPostingDto = {
  id: string;
  institutionName: string;
  title: string;
  applicationStartAt: string | null;
  applicationEndAt: string | null;
  dday: string;
  employmentType: string | null;
  region: string | null;
  careerRequirement: string | null;
  applyUrl: string | null;
  categories: string[];
  matchScore?: number;
  isBookmarked: boolean;
  ncsCategory: string | null;
  educationRequirement: string | null;
  hiringCount: number | null;
  isClosed: boolean;
};

export type JobPostingDetailDto = JobPostingDto & {
  announcementAt: string | null;
  emailApplyAddress: string | null;
  jobCategory: string | null;
  basicInfo: string | null;
  qualification: string | null;
  disqualification: string | null;
  preference: string | null;
  screeningProcess: string | null;
  applicationMethod: string | null;
  requiredDocuments: string | null;
  additionalNotice: string | null;
  files: Array<{
    id: string;
    fileName: string;
    fileType: string | null;
    fileUrl: string;
  }>;
  stages: Array<{
    id: string;
    stageName: string;
    stageOrder: number;
    startAt: string | null;
    endAt: string | null;
  }>;
};

export type HomeJobsResponseDto = {
  hotJobs: JobPostingDto[];
  recommendedJobs: JobPostingDto[];
  recommendationTypeName: string | null;
  bookmarkCount: number;
};

export type JobPostingListResponseDto = {
  items: JobPostingDto[];
  total: number;
  limit: number;
  offset: number;
  recommendationTypeName: string | null;
};

export type JobPostingCalendarResponseDto = {
  items: JobPostingDto[];
  total: number;
  startDate: string;
  endDate: string;
};

export type JobListView = "all" | "closing" | "recommended" | "bookmarked";

export type JobBookmarkResponseDto = {
  isBookmarked: boolean;
  bookmarkCount: number;
};
