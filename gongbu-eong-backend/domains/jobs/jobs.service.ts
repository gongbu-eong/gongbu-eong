import type {
  HomeJobsResponseDto,
  JobPostingCalendarResponseDto,
  JobPostingDetailDto,
  JobPostingDto,
  JobPostingListResponseDto,
} from "./jobs.dto";
import {
  findHotJobPostings,
  findCalendarJobPostings,
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
          regularOnly: true,
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
            ncsCategory: args.ncsCategory,
            region: args.region,
            employmentType: args.employmentType,
            educationRequirement: args.educationRequirement,
            careerRequirement: args.careerRequirement,
            startDate: args.startDate,
            endDate: args.endDate,
            sort: args.sort,
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

export async function getCalendarJobPostings(args: {
  startDate: string;
  endDate: string;
  userId?: string;
  view?: "all" | "bookmarked";
}): Promise<JobPostingCalendarResponseDto> {
  const diagnosisType = args.userId
    ? await findLatestDiagnosisType(args.userId)
    : null;
  const result =
    args.view === "bookmarked" && !args.userId
      ? { rows: [], total: 0 }
      : await findCalendarJobPostings({
          startDate: args.startDate,
          endDate: args.endDate,
          userId: args.userId,
          personalityCode: diagnosisType?.code,
          bookmarkedOnly: args.view === "bookmarked",
        });

  return {
    items: result.rows.map(toJobPostingDto),
    total: result.total,
    startDate: args.startDate,
    endDate: args.endDate,
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
  const applicationStartAt = row.application_start_at
    ? new Date(row.application_start_at).toISOString()
    : null;
  const applicationEndAt = row.application_end_at
    ? new Date(row.application_end_at).toISOString()
    : null;

  return {
    id: row.id,
    institutionName: row.institution_name,
    title: row.title,
    applicationStartAt,
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
      Boolean(applicationEndAt && isPastApplicationEndDate(applicationEndAt)),
    ...(row.match_score == null
      ? {}
      : { matchScore: Number(row.match_score) }),
  };
}

const SEOUL_TIME_ZONE = "Asia/Seoul";
const DAY_IN_MS = 86_400_000;
const seoulDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SEOUL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDday(value: string | null) {
  if (!value) return "상시";

  const days = daysUntilSeoulDate(value);
  if (days == null) return "상시";
  return days === 0 ? "D-Day" : `D-${days}`;
}

function isPastApplicationEndDate(value: string) {
  const endDay = toSeoulDayNumber(value);
  const todayDay = toSeoulDayNumber(new Date());
  return endDay != null && todayDay != null && endDay < todayDay;
}

function daysUntilSeoulDate(value: string) {
  const endDay = toSeoulDayNumber(value);
  const todayDay = toSeoulDayNumber(new Date());
  if (endDay == null || todayDay == null) return null;
  return Math.max(0, endDay - todayDay);
}

function toSeoulDayNumber(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = seoulDateFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) return null;

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MS);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
