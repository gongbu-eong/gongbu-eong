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
};

export async function findLatestDiagnosisType(userId: string) {
  const result = await query<{
    code: string;
    name: string;
  }>(
    `
      SELECT personality_types.code, personality_types.name
      FROM public.diagnosis_results results
      JOIN public.personality_types personality_types
        ON personality_types.id = results.personality_type_id
      LEFT JOIN public.diagnosis_login_conversions conversions
        ON conversions.diagnosis_result_id = results.id
       AND conversions.user_id = $1
      WHERE results.user_id = $1
         OR conversions.user_id = $1
      ORDER BY COALESCE(conversions.created_at, results.created_at) DESC
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] || null;
}

export async function findHotJobPostings(limit: number) {
  const result = await query<JobPostingRow>(
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
        AND (postings.application_end_at IS NULL OR postings.application_end_at >= NOW())
      GROUP BY postings.id, institutions.name
      ORDER BY
        postings.is_featured DESC,
        postings.view_count DESC,
        postings.application_end_at ASC NULLS LAST,
        postings.announcement_at DESC NULLS LAST,
        postings.created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function findRecommendedJobPostings(
  personalityCode: string,
  limit: number,
) {
  const result = await query<JobPostingRow>(
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
        array_agg(DISTINCT categories.name ORDER BY categories.name) AS categories,
        MAX(mappings.fit_weight)::integer AS match_score
      FROM public.job_postings postings
      JOIN public.job_posting_categories posting_categories
        ON posting_categories.job_posting_id = postings.id
      JOIN public.job_categories categories
        ON categories.id = posting_categories.job_category_id
      JOIN public.personality_job_category_mappings mappings
        ON mappings.job_category_id = categories.id
      JOIN public.personality_types personality_types
        ON personality_types.id = mappings.personality_type_id
       AND personality_types.code = $1
      LEFT JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      WHERE postings.is_active = TRUE
        AND categories.is_active = TRUE
        AND (postings.application_end_at IS NULL OR postings.application_end_at >= NOW())
      GROUP BY postings.id, institutions.name
      ORDER BY
        MAX(mappings.fit_weight) DESC,
        postings.is_featured DESC,
        postings.application_end_at ASC NULLS LAST,
        postings.announcement_at DESC NULLS LAST,
        postings.created_at DESC
      LIMIT $2
    `,
    [personalityCode, limit],
  );

  return result.rows;
}

export async function findJobPostings(args: {
  categoryCode?: string;
  limit: number;
  offset: number;
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
        AND (postings.application_end_at IS NULL OR postings.application_end_at >= NOW())
        ${categoryFilter}
      GROUP BY postings.id, institutions.name
      ORDER BY postings.application_end_at ASC NULLS LAST, postings.created_at DESC
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
