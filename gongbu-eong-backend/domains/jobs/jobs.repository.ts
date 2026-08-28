import { query } from "@/lib/db";

export type JobPostingRow = {
  id: string;
  institution_name: string;
  title: string;
  application_end_at: Date | string | null;
  employment_type: string | null;
  work_region: string | null;
  career_requirement: string | null;
  apply_url: string | null;
  categories: string[] | null;
  match_score?: number | string | null;
  is_bookmarked?: boolean;
  ncs_category: string | null;
  job_category?: string | null;
  education_requirement: string | null;
  hiring_count: number | null;
  is_active?: boolean;
  application_start_at?: Date | string | null;
  announcement_at?: Date | string | null;
};

export type JobPostingDetailRow = JobPostingRow & {
  email_apply_address: string | null;
  basic_info: string | null;
  qualification: string | null;
  disqualification: string | null;
  preference_condition: string | null;
  preference: string | null;
  screening_process: string | null;
  application_method: string | null;
  required_documents: string | null;
  additional_notice: string | null;
  files: Array<{
    id: string;
    file_name: string;
    file_type: string | null;
    file_url: string;
  }> | null;
  stages: Array<{
    id: string;
    stage_name: string;
    stage_order: number;
    start_at: string | null;
    end_at: string | null;
  }> | null;
};

export type JobPostingFileRow = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_url: string;
};

function splitMultiFilter(value?: string) {
  return (value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAnyTextFilter(column: string, value: string | undefined, values: unknown[]) {
  const filters = splitMultiFilter(value);
  if (!filters.length) return "";

  const conditions = filters.map((filter) => {
    const param = `$${values.push(`%${filter}%`)}`;
    return `COALESCE(${column}, '') ILIKE ${param}`;
  });

  return `AND (${conditions.join(" OR ")})`;
}

function buildEmploymentTypeFilter(value: string | undefined, values: unknown[]) {
  const filters = splitMultiFilter(value);
  if (!filters.length) return "";

  const conditions = filters.map((filter) => {
    if (filter === "정규직") {
      return `(
        ${employmentColumn()} = '정규직'
        OR (
          ${employmentColumn()} ILIKE '%정규%'
          AND ${employmentColumn()} NOT ILIKE '%비정규%'
        )
      )`;
    }
    const param = `$${values.push(`%${filter}%`)}`;
    return `COALESCE(postings.employment_type, '') ILIKE ${param}`;
  });

  return `AND (${conditions.join(" OR ")})`;
}

function employmentColumn() {
  return "COALESCE(postings.employment_type, '')";
}

export async function findLatestDiagnosisType(userId: string) {
  const result = await query<{
    code: string;
    name: string;
  }>(
    `
      SELECT personality_types.code, personality_types.name
      FROM public.diagnosis_results results
      JOIN public.diagnosis_runs runs
        ON runs.id = results.diagnosis_run_id
      JOIN public.personality_types personality_types
        ON personality_types.id = results.personality_type_id
      JOIN public.users users
        ON users.id = $1
      WHERE results.user_id = $1
         OR runs.user_id = $1
         OR EXISTS (
           SELECT 1
           FROM public.diagnosis_login_conversions conversions
           WHERE conversions.diagnosis_result_id = results.id
             AND conversions.user_id = $1
         )
      ORDER BY
        (results.id = users.selected_diagnosis_result_id) DESC,
        runs.completed_at DESC NULLS LAST,
        results.created_at DESC,
        results.id DESC
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

export async function findDiagnosisTypeForUserResult(
  userId: string,
  resultId: string,
) {
  const result = await query<{ code: string; name: string }>(
    `
      SELECT personality_types.code, personality_types.name
      FROM public.diagnosis_results results
      JOIN public.diagnosis_runs runs
        ON runs.id = results.diagnosis_run_id
      JOIN public.personality_types personality_types
        ON personality_types.id = results.personality_type_id
      WHERE results.id = $2
        AND (
          results.user_id = $1
          OR runs.user_id = $1
          OR EXISTS (
            SELECT 1
            FROM public.diagnosis_login_conversions conversions
            WHERE conversions.diagnosis_result_id = results.id
              AND conversions.user_id = $1
          )
        )
      LIMIT 1
    `,
    [userId, resultId],
  );

  return result.rows[0] || null;
}

export async function findHotJobPostings(limit: number, userId?: string) {
  const result = await query<JobPostingRow>(
    `
      SELECT
        postings.id,
        COALESCE(institutions.name, postings.raw_payload->'list'->>'instNm', '기관 미정') AS institution_name,
        postings.title,
        postings.application_start_at,
        postings.application_end_at,
        postings.employment_type,
        postings.work_region,
        postings.career_requirement,
        postings.apply_url,
        postings.ncs_category,
        postings.education_requirement,
        postings.hiring_count,
        postings.is_active,
        (
          $2::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_job_bookmarks bookmarks
            WHERE bookmarks.user_id = $2::uuid
              AND bookmarks.job_posting_id = postings.id
          )
        ) AS is_bookmarked,
        COALESCE(
          array_agg(DISTINCT categories.name ORDER BY categories.name)
            FILTER (WHERE categories.id IS NOT NULL),
          ARRAY[]::text[]
        ) AS categories
      FROM public.job_postings postings
      LEFT JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      LEFT JOIN public.job_posting_categories posting_categories
        ON posting_categories.job_posting_id = postings.id
      LEFT JOIN public.job_categories categories
        ON categories.id = posting_categories.job_category_id
      WHERE postings.is_active = TRUE
        AND (postings.application_end_at IS NULL OR postings.application_end_at::date >= CURRENT_DATE)
        AND (
          postings.employment_type = '정규직'
          OR (
            postings.employment_type ILIKE '%정규%'
            AND postings.employment_type NOT ILIKE '%비정규%'
          )
        )
      GROUP BY postings.id, institutions.name
      ORDER BY
        postings.is_featured DESC,
        postings.view_count DESC,
        postings.application_end_at ASC NULLS LAST,
        postings.announcement_at DESC NULLS LAST,
        postings.created_at DESC
      LIMIT $1
    `,
    [limit, userId || null],
  );

  return result.rows;
}

export async function findRecommendedJobPostings(
  args: {
    personalityCode: string;
    limit: number;
    offset?: number;
    userId?: string;
    monthlyRegularOnly?: boolean;
    regularOnly?: boolean;
    ncsCategory?: string;
    region?: string;
    employmentType?: string;
    educationRequirement?: string;
    careerRequirement?: string;
    startDate?: string;
    endDate?: string;
    sort?: "closing" | "latest" | "views" | "recommended";
  },
) {
  const values: unknown[] = [args.personalityCode];
  const categoryFilter = buildAnyTextFilter("categories.name", args.ncsCategory, values);
  const regionFilter = buildAnyTextFilter("postings.work_region", args.region, values);
  const employmentFilter = buildEmploymentTypeFilter(args.employmentType, values);
  const educationFilter = buildAnyTextFilter("postings.education_requirement", args.educationRequirement, values);
  const careerFilter = buildAnyTextFilter("postings.career_requirement", args.careerRequirement, values);
  const startDateFilter = args.startDate
    ? `AND postings.announcement_at::date >= $${values.push(args.startDate)}::date`
    : "";
  const endDateFilter = args.endDate
    ? `AND postings.announcement_at::date <= $${values.push(args.endDate)}::date`
    : "";
  const limitParam = `$${values.push(args.limit)}`;
  const userParam = `$${values.push(args.userId || null)}`;
  const offsetParam = `$${values.push(args.offset || 0)}`;
  const regularEmploymentFilter = args.monthlyRegularOnly || args.regularOnly
    ? `AND (
          postings.employment_type = '정규직'
          OR (
            postings.employment_type ILIKE '%정규%'
            AND postings.employment_type NOT ILIKE '%비정규%'
          )
        )`
    : "";
  const monthlyDateFilter = args.monthlyRegularOnly
    ? `AND COALESCE(
          postings.application_start_at,
          postings.announcement_at,
          postings.created_at
        ) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND COALESCE(postings.application_end_at, 'infinity'::timestamptz)
          >= DATE_TRUNC('month', CURRENT_DATE)`
    : "";
  const orderBy =
    args.sort === "latest"
      ? "postings.announcement_at DESC NULLS LAST, postings.created_at DESC"
      : args.sort === "views"
        ? "postings.view_count DESC, postings.application_end_at ASC NULLS LAST"
        : `
          MAX(matched_categories.fit_weight) DESC,
          CASE
            WHEN postings.employment_type = '정규직' THEN 0
            WHEN postings.employment_type ILIKE '%정규%'
              AND postings.employment_type NOT ILIKE '%비정규%' THEN 0
            ELSE 1
          END,
          postings.application_end_at ASC NULLS LAST,
          postings.view_count DESC,
          postings.created_at DESC
        `;
  const result = await query<JobPostingRow & { total_count: string }>(
    `
      WITH mapped_categories AS (
        SELECT categories.name, mappings.fit_weight, mappings.sort_order
        FROM public.personality_job_category_mappings mappings
        JOIN public.personality_types personality_types
          ON personality_types.id = mappings.personality_type_id
        JOIN public.job_categories categories
          ON categories.id = mappings.job_category_id
        WHERE personality_types.code = $1
          AND categories.is_active = TRUE
          ${categoryFilter}
        ORDER BY mappings.fit_weight DESC, mappings.sort_order ASC
        LIMIT 6
      ),
      matched_categories AS (
        SELECT
          postings.id AS job_posting_id,
          mapped_categories.name,
          mapped_categories.fit_weight,
          mapped_categories.sort_order
        FROM public.job_postings postings
        JOIN mapped_categories
          ON POSITION(
            REGEXP_REPLACE(mapped_categories.name, '[[:space:]·.]', '', 'g')
            IN REGEXP_REPLACE(COALESCE(postings.ncs_category, ''), '[[:space:]·.]', '', 'g')
          ) > 0
      )
      SELECT
        postings.id,
        COALESCE(institutions.name, postings.raw_payload->'list'->>'instNm', '기관 미정') AS institution_name,
        postings.title,
        postings.application_start_at,
        postings.application_end_at,
        postings.employment_type,
        postings.work_region,
        postings.career_requirement,
        postings.apply_url,
        postings.ncs_category,
        postings.education_requirement,
        postings.hiring_count,
        postings.is_active,
        COUNT(*) OVER() AS total_count,
        (
          ${userParam}::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_job_bookmarks bookmarks
            WHERE bookmarks.user_id = ${userParam}::uuid
              AND bookmarks.job_posting_id = postings.id
          )
        ) AS is_bookmarked,
        array_agg(DISTINCT matched_categories.name ORDER BY matched_categories.name) AS categories,
        MAX(matched_categories.fit_weight)::integer AS match_score
      FROM public.job_postings postings
      JOIN matched_categories
        ON matched_categories.job_posting_id = postings.id
      LEFT JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      WHERE postings.is_active = TRUE
        AND (postings.application_end_at IS NULL OR postings.application_end_at::date >= CURRENT_DATE)
        ${regularEmploymentFilter}
        ${monthlyDateFilter}
        ${regionFilter}
        ${employmentFilter}
        ${educationFilter}
        ${careerFilter}
        ${startDateFilter}
        ${endDateFilter}
      GROUP BY postings.id, institutions.name
      ORDER BY ${orderBy}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values,
  );

  return {
    rows: result.rows,
    total: Number(result.rows[0]?.total_count || 0),
  };
}

export async function findJobPostings(args: {
  categoryCode?: string;
  limit: number;
  offset: number;
  userId?: string;
  bookmarkedOnly?: boolean;
  query?: string;
  ncsCategory?: string;
  region?: string;
  employmentType?: string;
  educationRequirement?: string;
  careerRequirement?: string;
  startDate?: string;
  endDate?: string;
  sort?: "closing" | "latest" | "views" | "recommended";
}) {
  const values: unknown[] = [];
  const categoryFilter = args.categoryCode
    ? `AND EXISTS (
        SELECT 1
        FROM public.job_posting_categories filter_posting_categories
        JOIN public.job_categories filter_categories
          ON filter_categories.id = filter_posting_categories.job_category_id
        WHERE filter_posting_categories.job_posting_id = postings.id
          AND filter_categories.source_code = $${values.push(args.categoryCode)}
      )`
    : "";
  const userIdParam = `$${values.push(args.userId || null)}`;
  const bookmarkFilter = args.bookmarkedOnly
    ? `AND EXISTS (
        SELECT 1
        FROM public.user_job_bookmarks filter_bookmarks
        WHERE filter_bookmarks.user_id = ${userIdParam}::uuid
          AND filter_bookmarks.job_posting_id = postings.id
      )`
    : "";
  const queryFilter = args.query
    ? `AND (
        postings.title ILIKE $${values.push(`%${args.query}%`)}
        OR COALESCE(institutions.name, '') ILIKE $${values.length}
      )`
    : "";
  const ncsFilter = buildAnyTextFilter("postings.ncs_category", args.ncsCategory, values);
  const regionFilter = buildAnyTextFilter("postings.work_region", args.region, values);
  const employmentFilter = buildEmploymentTypeFilter(args.employmentType, values);
  const educationFilter = buildAnyTextFilter("postings.education_requirement", args.educationRequirement, values);
  const careerFilter = buildAnyTextFilter("postings.career_requirement", args.careerRequirement, values);
  const startDateFilter = args.startDate
    ? `AND postings.announcement_at::date >= $${values.push(args.startDate)}::date`
    : "";
  const endDateFilter = args.endDate
    ? `AND postings.announcement_at::date <= $${values.push(args.endDate)}::date`
    : "";
  const orderBy =
    args.sort === "latest"
      ? "postings.announcement_at DESC NULLS LAST, postings.created_at DESC"
      : args.sort === "views"
        ? "postings.view_count DESC, postings.application_end_at ASC NULLS LAST"
        : "postings.application_end_at ASC NULLS LAST, postings.created_at DESC";

  values.push(args.limit, args.offset);
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;

  const result = await query<JobPostingRow & { total_count: string }>(
    `
      SELECT
        postings.id,
        COALESCE(institutions.name, postings.raw_payload->'list'->>'instNm', '기관 미정') AS institution_name,
        postings.title,
        postings.application_end_at,
        postings.employment_type,
        postings.work_region,
        postings.career_requirement,
        postings.apply_url,
        postings.ncs_category,
        postings.education_requirement,
        postings.hiring_count,
        postings.is_active,
        (
          ${userIdParam}::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_job_bookmarks bookmarks
            WHERE bookmarks.user_id = ${userIdParam}::uuid
              AND bookmarks.job_posting_id = postings.id
          )
        ) AS is_bookmarked,
        COALESCE(
          array_agg(DISTINCT categories.name ORDER BY categories.name)
            FILTER (WHERE categories.id IS NOT NULL),
          ARRAY[]::text[]
        ) AS categories,
        COUNT(*) OVER() AS total_count
      FROM public.job_postings postings
      LEFT JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      LEFT JOIN public.job_posting_categories posting_categories
        ON posting_categories.job_posting_id = postings.id
      LEFT JOIN public.job_categories categories
        ON categories.id = posting_categories.job_category_id
      WHERE postings.is_active = TRUE
        AND (postings.application_end_at IS NULL OR postings.application_end_at::date >= CURRENT_DATE)
        ${categoryFilter}
        ${bookmarkFilter}
        ${queryFilter}
        ${ncsFilter}
        ${regionFilter}
        ${employmentFilter}
        ${educationFilter}
        ${careerFilter}
        ${startDateFilter}
        ${endDateFilter}
      GROUP BY postings.id, institutions.name
      ORDER BY ${orderBy}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values,
  );

  return {
    rows: result.rows,
    total: Number(result.rows[0]?.total_count || 0),
  };
}

export async function findCalendarJobPostings(args: {
  startDate: string;
  endDate: string;
  userId?: string;
  personalityCode?: string;
  bookmarkedOnly?: boolean;
}) {
  const bookmarkFilter = args.bookmarkedOnly
    ? `AND $1::uuid IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.user_job_bookmarks filter_bookmarks
         WHERE filter_bookmarks.user_id = $1::uuid
           AND filter_bookmarks.job_posting_id = postings.id
       )`
    : "";

  const result = await query<JobPostingRow & { total_count: string }>(
    `
      SELECT
        postings.id,
        COALESCE(institutions.name, postings.raw_payload->'list'->>'instNm', '기관 미정') AS institution_name,
        postings.title,
        postings.application_start_at,
        postings.application_end_at,
        postings.employment_type,
        postings.work_region,
        postings.career_requirement,
        postings.apply_url,
        postings.ncs_category,
        postings.education_requirement,
        postings.hiring_count,
        postings.is_active,
        MAX(matched_categories.fit_weight)::integer AS match_score,
        (
          $1::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_job_bookmarks bookmarks
            WHERE bookmarks.user_id = $1::uuid
              AND bookmarks.job_posting_id = postings.id
          )
        ) AS is_bookmarked,
        COALESCE(
          array_agg(DISTINCT categories.name ORDER BY categories.name)
            FILTER (WHERE categories.id IS NOT NULL),
          ARRAY[]::text[]
        ) AS categories,
        COUNT(*) OVER() AS total_count
      FROM public.job_postings postings
      LEFT JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      LEFT JOIN (
        SELECT categories.id, categories.name, mappings.fit_weight
        FROM public.personality_job_category_mappings mappings
        JOIN public.personality_types personality_types
          ON personality_types.id = mappings.personality_type_id
        JOIN public.job_categories categories
          ON categories.id = mappings.job_category_id
        WHERE personality_types.code = $4
          AND categories.is_active = TRUE
        ORDER BY
          mappings.fit_weight DESC,
          mappings.sort_order ASC,
          categories.sort_order ASC
        LIMIT 6
      ) matched_categories
        ON (
          POSITION(
            REGEXP_REPLACE(matched_categories.name, '[[:space:]·.]', '', 'g')
            IN REGEXP_REPLACE(COALESCE(postings.ncs_category, ''), '[[:space:]·.]', '', 'g')
          ) > 0
          OR EXISTS (
            SELECT 1
            FROM public.job_posting_categories matched_posting_categories
            WHERE matched_posting_categories.job_posting_id = postings.id
              AND matched_posting_categories.job_category_id = matched_categories.id
          )
        )
      LEFT JOIN public.job_posting_categories posting_categories
        ON posting_categories.job_posting_id = postings.id
      LEFT JOIN public.job_categories categories
        ON categories.id = posting_categories.job_category_id
      WHERE COALESCE(
          postings.application_start_at,
          postings.application_end_at,
          postings.announcement_at,
          postings.created_at
        ) < ($3::date + INTERVAL '1 day')
        AND COALESCE(
          postings.application_end_at,
          postings.application_start_at,
          'infinity'::timestamptz
        ) >= $2::date
        ${bookmarkFilter}
      GROUP BY postings.id, institutions.name
      ORDER BY
        LEAST(
          COALESCE(postings.application_start_at::date, '9999-12-31'::date),
          COALESCE(postings.application_end_at::date, '9999-12-31'::date)
        ) ASC,
        postings.view_count DESC,
        postings.created_at DESC
    `,
    [args.userId || null, args.startDate, args.endDate, args.personalityCode || null],
  );

  return {
    rows: result.rows,
    total: Number(result.rows[0]?.total_count || 0),
  };
}

export async function findJobPostingById(jobPostingId: string, userId?: string) {
  const result = await query<JobPostingDetailRow>(
    `
      SELECT
        postings.id,
        COALESCE(institutions.name, postings.raw_payload->'list'->>'instNm', '기관 미정') AS institution_name,
        postings.title,
        postings.application_start_at,
        postings.application_end_at,
        postings.announcement_at,
        postings.employment_type,
        postings.work_region,
        postings.career_requirement,
        postings.education_requirement,
        postings.hiring_count,
        postings.apply_url,
        postings.email_apply_address,
        postings.ncs_category,
        postings.job_category,
        postings.is_active,
        (
          $2::uuid IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_job_bookmarks bookmarks
            WHERE bookmarks.user_id = $2::uuid
              AND bookmarks.job_posting_id = postings.id
          )
        ) AS is_bookmarked,
        COALESCE(
          (
            SELECT array_agg(DISTINCT categories.name ORDER BY categories.name)
            FROM public.job_posting_categories posting_categories
            JOIN public.job_categories categories
              ON categories.id = posting_categories.job_category_id
            WHERE posting_categories.job_posting_id = postings.id
          ),
          ARRAY[]::text[]
        ) AS categories,
        details.basic_info,
        details.qualification,
        details.disqualification,
        COALESCE(
          NULLIF(BTRIM(postings.raw_payload->'list'->>'prefCondCn'), ''),
          NULLIF(BTRIM(postings.raw_payload->'detail'->>'prefCondCn'), ''),
          NULLIF(BTRIM(postings.raw_payload->>'prefCondCn'), ''),
          NULLIF(BTRIM(postings.raw_payload->'list'->>'preferenceCondition'), ''),
          NULLIF(BTRIM(postings.raw_payload->'detail'->>'preferenceCondition'), ''),
          NULLIF(BTRIM(postings.raw_payload->>'preferenceCondition'), '')
        ) AS preference_condition,
        details.preference,
        details.screening_process,
        details.application_method,
        details.required_documents,
        details.additional_notice,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', files.id,
                'file_name', files.file_name,
                'file_type', files.file_type,
                'file_url', files.file_url
              )
              ORDER BY files.sort_order, files.created_at
            )
            FROM public.job_posting_files files
            WHERE files.job_posting_id = postings.id
          ),
          '[]'::jsonb
        ) AS files,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', stages.id,
                'stage_name', stages.stage_name,
                'stage_order', stages.stage_order,
                'start_at', stages.start_at,
                'end_at', stages.end_at
              )
              ORDER BY stages.stage_order
            )
            FROM public.job_posting_stages stages
            WHERE stages.job_posting_id = postings.id
          ),
          '[]'::jsonb
        ) AS stages
      FROM public.job_postings postings
      LEFT JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      LEFT JOIN public.job_posting_details details
        ON details.job_posting_id = postings.id
      WHERE postings.id = $1
      LIMIT 1
    `,
    [jobPostingId, userId || null],
  );

  return result.rows[0] || null;
}

export async function findJobPostingFileById(fileId: string) {
  const result = await query<JobPostingFileRow>(
    `
      SELECT id, file_name, file_type, file_url
      FROM public.job_posting_files
      WHERE id = $1
      LIMIT 1
    `,
    [fileId],
  );

  return result.rows[0] || null;
}

export async function increaseJobPostingViewCount(jobPostingId: string) {
  await query(
    `
      UPDATE public.job_postings
      SET view_count = COALESCE(view_count, 0) + 1
      WHERE id = $1
    `,
    [jobPostingId],
  );
}

export async function countUserJobBookmarks(userId: string) {
  const result = await query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM public.user_job_bookmarks bookmarks
      JOIN public.job_postings postings
        ON postings.id = bookmarks.job_posting_id
      WHERE bookmarks.user_id = $1
        AND postings.is_active = TRUE
        AND (postings.application_end_at IS NULL OR postings.application_end_at::date >= CURRENT_DATE)
    `,
    [userId],
  );

  return Number(result.rows[0]?.count || 0);
}

export async function createJobBookmark(userId: string, jobPostingId: string) {
  const result = await query<{ id: string }>(
    `
      INSERT INTO public.user_job_bookmarks (
        user_id,
        job_posting_id,
        entry_source
      )
      SELECT $1, postings.id, 'main_home'::public.entry_source
      FROM public.job_postings postings
      WHERE postings.id = $2
        AND postings.is_active = TRUE
      ON CONFLICT (user_id, job_posting_id) DO UPDATE
      SET entry_source = EXCLUDED.entry_source
      RETURNING id
    `,
    [userId, jobPostingId],
  );

  return Boolean(result.rows[0]);
}

export async function deleteJobBookmark(userId: string, jobPostingId: string) {
  await query(
    `
      DELETE FROM public.user_job_bookmarks
      WHERE user_id = $1
        AND job_posting_id = $2
    `,
    [userId, jobPostingId],
  );
}
