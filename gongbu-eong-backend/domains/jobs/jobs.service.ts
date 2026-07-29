import type {
  HomeJobsResponseDto,
  JobPostingDto,
  JobPostingListResponseDto,
} from "./jobs.dto";
import {
  findHotJobPostings,
  findJobPostings,
  findLatestDiagnosisType,
  findRecommendedJobPostings,
  type JobPostingRow,
} from "./jobs.repository";

export async function getHomeJobs(
  userId?: string,
): Promise<HomeJobsResponseDto> {
  const diagnosisType = userId
    ? await findLatestDiagnosisType(userId)
    : null;

  const [hotRows, recommendedRows] = await Promise.all([
    findHotJobPostings(12),
    diagnosisType
      ? findRecommendedJobPostings(diagnosisType.code, 20)
      : Promise.resolve([]),
  ]);

  return {
    hotJobs: hotRows.map(toJobPostingDto),
    recommendedJobs: recommendedRows.map(toJobPostingDto),
    recommendationTypeName: diagnosisType?.name || null,
  };
}

export async function getJobPostings(args: {
  categoryCode?: string;
  limit?: number;
  offset?: number;
}): Promise<JobPostingListResponseDto> {
  const limit = clamp(args.limit ?? 20, 1, 100);
  const offset = Math.max(args.offset ?? 0, 0);
  const result = await findJobPostings({
    categoryCode: args.categoryCode,
    limit,
    offset,
  });

  return {
    items: result.rows.map(toJobPostingDto),
    total: result.total,
    limit,
    offset,
  };
}

function toJobPostingDto(row: JobPostingRow): JobPostingDto {
  const applicationEndAt = row.application_end_at
    ? new Date(row.application_end_at).toISOString()
    : null;

  return {
    id: row.id,
    institutionName: row.institution_name,
    title: row.title,
    applicationEndAt,
    dday: toDday(applicationEndAt),
    employmentType: row.employment_type,
    region: row.work_region,
    careerRequirement: row.career_requirement,
    applyUrl: row.apply_url,
    categories: row.categories || [],
    ...(row.match_score == null
      ? {}
      : { matchScore: Number(row.match_score) }),
  };
}

function toDday(value: string | null) {
  if (!value) return "상시";

  const end = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.max(0, Math.ceil((end - today.getTime()) / 86_400_000));
  return days === 0 ? "D-Day" : `D-${days}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
