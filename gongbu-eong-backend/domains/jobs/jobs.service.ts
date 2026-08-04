import type {
  HomeJobsResponseDto,
  JobPostingDetailDto,
  JobPostingDto,
  JobPostingListResponseDto,
} from "./jobs.dto";
import {
  findHotJobPostings,
  findJobPostings,
  findLatestDiagnosisType,
  findDiagnosisTypeForUserResult,
  findRecommendedJobPostings,
  countUserJobBookmarks,
  createJobBookmark,
  deleteJobBookmark,
  findJobPostingById,
  findJobPostingFileById,
  increaseJobPostingViewCount,
  type JobPostingRow,
} from "./jobs.repository";

export async function getJobPostingFile(fileId: string) {
  const file = await findJobPostingFileById(fileId);
  if (!file) return null;

  return {
    id: file.id,
    fileName: file.file_name,
    fileType: file.file_type,
    fileUrl: normalizeJobFileUrl(file.file_url),
  };
}

export async function getHomeJobs(
  userId?: string,
): Promise<HomeJobsResponseDto> {
  const diagnosisType = userId
    ? await findLatestDiagnosisType(userId)
    : null;

  const [hotRows, recommendedResult, bookmarkCount] = await Promise.all([
    findHotJobPostings(12, userId),
    diagnosisType
      ? findRecommendedJobPostings({
          personalityCode: diagnosisType.code,
          limit: 5,
          userId,
        })
      : Promise.resolve({ rows: [], total: 0 }),
    userId ? countUserJobBookmarks(userId) : Promise.resolve(0),
  ]);

  return {
    hotJobs: hotRows.map(toJobPostingDto),
    recommendedJobs: recommendedResult.rows.map(toJobPostingDto),
    recommendationTypeName: diagnosisType?.name || null,
    bookmarkCount,
  };
}

export async function getJobPostings(args: {
  categoryCode?: string;
  limit?: number;
  offset?: number;
  view?: "all" | "closing" | "recommended" | "bookmarked";
  userId?: string;
  diagnosisResultId?: string;
  query?: string;
  ncsCategory?: string;
  region?: string;
  employmentType?: string;
  educationRequirement?: string;
  careerRequirement?: string;
  startDate?: string;
  endDate?: string;
  monthlyRegularOnly?: boolean;
  sort?: "closing" | "latest" | "views" | "recommended";
}): Promise<JobPostingListResponseDto> {
  const limit = clamp(args.limit ?? 20, 1, 100);
  const offset = Math.max(args.offset ?? 0, 0);
  const view = args.view || "all";

  if (view === "recommended") {
    const diagnosisType = args.userId
      ? args.diagnosisResultId
        ? await findDiagnosisTypeForUserResult(
            args.userId,
            args.diagnosisResultId,
          )
        : await findLatestDiagnosisType(args.userId)
      : null;
    const result = diagnosisType
      ? await findRecommendedJobPostings(
          {
            personalityCode: diagnosisType.code,
            limit,
            offset,
            userId: args.userId,
            monthlyRegularOnly: args.monthlyRegularOnly,
          },
        )
      : { rows: [], total: 0 };

    return {
      items: result.rows.map(toJobPostingDto),
      total: result.total,
      limit,
      offset,
      recommendationTypeName: diagnosisType?.name || null,
    };
  }

  const result = await findJobPostings({
    categoryCode: args.categoryCode,
    limit,
    offset,
    userId: args.userId,
    bookmarkedOnly: view === "bookmarked",
    query: args.query,
    ncsCategory: args.ncsCategory,
    region: args.region,
    employmentType: args.employmentType,
    educationRequirement: args.educationRequirement,
    careerRequirement: args.careerRequirement,
    startDate: args.startDate,
    endDate: args.endDate,
    sort: view === "closing" ? "closing" : args.sort,
  });

  return {
    items: result.rows.map(toJobPostingDto),
    total: result.total,
    limit,
    offset,
    recommendationTypeName: null,
  };
}

export async function getJobPostingDetail(
  jobPostingId: string,
  userId?: string,
): Promise<JobPostingDetailDto | null> {
  const row = await findJobPostingById(jobPostingId, userId);
  if (!row) return null;

  await increaseJobPostingViewCount(jobPostingId);
  const base = toJobPostingDto(row);
  const toIso = (value: Date | string | null | undefined) =>
    value ? new Date(value).toISOString() : null;

  return {
    ...base,
    applicationStartAt: toIso(row.application_start_at),
    announcementAt: toIso(row.announcement_at),
    emailApplyAddress: row.email_apply_address,
    jobCategory: row.job_category || null,
    basicInfo: row.basic_info,
    qualification: row.qualification,
    disqualification: row.disqualification,
    preference: row.preference,
    screeningProcess: row.screening_process,
    applicationMethod: row.application_method,
    requiredDocuments: row.required_documents,
    additionalNotice: row.additional_notice,
    files: (row.files || []).map((file) => ({
      id: file.id,
      fileName: file.file_name,
      fileType: file.file_type,
      fileUrl: normalizeJobFileUrl(file.file_url),
    })),
    stages: (row.stages || []).map((stage) => ({
      id: stage.id,
      stageName: stage.stage_name,
      stageOrder: stage.stage_order,
      startAt: stage.start_at ? new Date(stage.start_at).toISOString() : null,
      endAt: stage.end_at ? new Date(stage.end_at).toISOString() : null,
    })),
  };
}

function normalizeJobFileUrl(fileUrl: string) {
  try {
    const url = new URL(fileUrl);
    if (
      url.hostname === "opendata.alio.go.kr" &&
      url.pathname === "/recruit/downloadAtchFile"
    ) {
      const fileNo = url.searchParams.get("recrutAtchFileNo");
      if (fileNo && /^\d+$/.test(fileNo)) {
        return `https://www.alio.go.kr/download/download.json?fileNo=${fileNo}`;
      }
    }
  } catch {
    return fileUrl;
  }

  return fileUrl;
}

export async function addJobBookmark(userId: string, jobPostingId: string) {
  const created = await createJobBookmark(userId, jobPostingId);
  if (!created) {
    throw new Error("존재하지 않거나 종료된 공고입니다.");
  }

  return {
    isBookmarked: true,
    bookmarkCount: await countUserJobBookmarks(userId),
  };
}

export async function removeJobBookmark(userId: string, jobPostingId: string) {
  await deleteJobBookmark(userId, jobPostingId);
  return {
    isBookmarked: false,
    bookmarkCount: await countUserJobBookmarks(userId),
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
    isBookmarked: Boolean(row.is_bookmarked),
    ncsCategory: row.ncs_category,
    educationRequirement: row.education_requirement,
    hiringCount: row.hiring_count,
    isClosed:
      row.is_active === false ||
      Boolean(applicationEndAt && new Date(applicationEndAt).getTime() < Date.now()),
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
