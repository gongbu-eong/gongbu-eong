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

export type JobPostingFileDto = {
  id: string;
  fileName: string;
  fileType: string | null;
  fileUrl: string;
};

export type JobPostingStageDto = {
  id: string;
  stageName: string;
  stageOrder: number;
  startAt: string | null;
  endAt: string | null;
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
  files: JobPostingFileDto[];
  stages: JobPostingStageDto[];
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
