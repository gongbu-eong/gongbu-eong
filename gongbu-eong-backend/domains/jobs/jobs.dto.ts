export type JobPostingDto = {
  id: string;
  institutionName: string;
  title: string;
  applicationEndAt: string | null;
  dday: string;
  employmentType: string | null;
  region: string | null;
  careerRequirement: string | null;
  applyUrl: string | null;
  categories: string[];
  matchScore?: number;
};

export type HomeJobsResponseDto = {
  hotJobs: JobPostingDto[];
  recommendedJobs: JobPostingDto[];
  recommendationTypeName: string | null;
};

export type JobPostingListResponseDto = {
  items: JobPostingDto[];
  total: number;
  limit: number;
  offset: number;
};
