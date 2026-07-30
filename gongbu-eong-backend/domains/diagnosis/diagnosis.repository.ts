import { PoolClient } from "pg";
import { db, query } from "@/lib/db";
import type { DiagnosisTypeCode } from "./diagnosis.dto";

type QuestionSetRow = {
  id: string;
  title: string;
  version: number;
};

type QuestionOptionRow = {
  question_id: string;
  question_no: number;
  question_text: string;
  trait_key: string;
  option_id: string;
  option_no: number;
  option_text: string;
  score: number;
};

type AnswerScoreRow = {
  question_id: string;
  question_no: number;
  option_id: string;
  trait_key: string;
  raw_score: number;
  score: number;
};

type PersonalityTypeRow = {
  id: string;
  code: DiagnosisTypeCode;
  name: string;
  summary: string;
};

export type LatestDiagnosisResultRow = {
  run_id: string;
  result_id: string;
  type_code: DiagnosisTypeCode;
  type_name: string;
  summary: string | null;
  stability_score: number;
  challenge_score: number;
  teamwork_axis_percent: number;
  execution_axis_percent: number;
  principle_axis_percent: number;
  stability_axis_percent: number;
  strengths: string[];
  weaknesses: string[];
  raw_result: Record<string, unknown> | null;
  completed_at: Date | string;
};

export type DiagnosisResultHistoryRow = {
  run_id: string;
  result_id: string;
  type_code: DiagnosisTypeCode;
  type_name: string;
  completed_at: Date | string;
};

export async function findActiveQuestionSet() {
  const result = await query<QuestionSetRow>(`
    SELECT id, title, version
    FROM public.diagnosis_question_sets
    WHERE code = 'civil-service-basic-v1'
      AND is_active = TRUE
    ORDER BY version DESC
    LIMIT 1
  `);

  return result.rows[0];
}

export async function findQuestionsWithOptions(questionSetId: string) {
  const result = await query<QuestionOptionRow>(
    `
      SELECT
        q.id AS question_id,
        q.question_no,
        q.question_text,
        q.trait_key,
        o.id AS option_id,
        o.option_no,
        o.option_text,
        o.score
      FROM public.diagnosis_questions q
      JOIN public.diagnosis_question_options o
        ON o.question_id = q.id
      WHERE q.question_set_id = $1
        AND q.is_active = TRUE
      ORDER BY q.question_no ASC, o.option_no ASC
    `,
    [questionSetId],
  );

  return result.rows;
}

export async function countCompletedDiagnosisRuns() {
  const result = await query<{ participant_count: string }>(`
    SELECT COUNT(*) AS participant_count
    FROM public.diagnosis_runs
    WHERE completed_at IS NOT NULL
  `);

  return Number(result.rows[0]?.participant_count || 0);
}

export async function findAnswerScores(
  answers: { questionId: string; optionId: string }[],
) {
  const result = await query<AnswerScoreRow>(
    `
      SELECT
        q.id AS question_id,
        q.question_no,
        o.id AS option_id,
        q.trait_key,
        o.score AS raw_score,
        CASE
          WHEN q.reverse_scored THEN 6 - o.score
          ELSE o.score
        END AS score
      FROM public.diagnosis_questions q
      JOIN public.diagnosis_question_options o
        ON o.question_id = q.id
      WHERE (q.id, o.id) IN (
        SELECT *
        FROM UNNEST($1::uuid[], $2::uuid[])
      )
    `,
    [
      answers.map((answer) => answer.questionId),
      answers.map((answer) => answer.optionId),
    ],
  );

  return result.rows;
}

export async function findPersonalityType(code: DiagnosisTypeCode) {
  const result = await query<PersonalityTypeRow>(
    `
      SELECT id, code, name, summary
      FROM public.personality_types
      WHERE code = $1
      LIMIT 1
    `,
    [code],
  );

  return result.rows[0];
}

export async function findLatestDiagnosisResultForUser(userId: string) {
  const result = await query<LatestDiagnosisResultRow>(
    `
      SELECT
        runs.id AS run_id,
        results.id AS result_id,
        personality_types.code AS type_code,
        personality_types.name AS type_name,
        results.summary,
        results.stability_score,
        results.challenge_score,
        results.stability_axis_percent,
        results.teamwork_axis_percent,
        results.execution_axis_percent,
        results.principle_axis_percent,
        results.strengths,
        results.weaknesses,
        results.raw_result,
        COALESCE(runs.completed_at, results.created_at) AS completed_at
      FROM public.diagnosis_results results
      JOIN public.diagnosis_runs runs
        ON runs.id = results.diagnosis_run_id
      JOIN public.personality_types personality_types
        ON personality_types.id = results.personality_type_id
      WHERE results.user_id = $1
         OR runs.user_id = $1
         OR EXISTS (
           SELECT 1
           FROM public.diagnosis_login_conversions conversions
           WHERE conversions.diagnosis_result_id = results.id
             AND conversions.user_id = $1
         )
      ORDER BY
        runs.completed_at DESC NULLS LAST,
        results.created_at DESC,
        results.id DESC
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0];
}

export async function findDiagnosisResultForUser(
  userId: string,
  resultId: string,
) {
  const result = await query<LatestDiagnosisResultRow>(
    `
      SELECT
        runs.id AS run_id,
        results.id AS result_id,
        personality_types.code AS type_code,
        personality_types.name AS type_name,
        results.summary,
        results.stability_score,
        results.challenge_score,
        results.stability_axis_percent,
        results.teamwork_axis_percent,
        results.execution_axis_percent,
        results.principle_axis_percent,
        results.strengths,
        results.weaknesses,
        results.raw_result,
        COALESCE(runs.completed_at, results.created_at) AS completed_at
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

  return result.rows[0];
}

export async function findDiagnosisResultHistory(args: {
  userId: string;
  limit: number;
  cursor?: string;
}) {
  const result = await query<DiagnosisResultHistoryRow>(
    `
      SELECT
        runs.id AS run_id,
        results.id AS result_id,
        personality_types.code AS type_code,
        personality_types.name AS type_name,
        COALESCE(runs.completed_at, results.created_at) AS completed_at
      FROM public.diagnosis_results results
      JOIN public.diagnosis_runs runs
        ON runs.id = results.diagnosis_run_id
      JOIN public.personality_types personality_types
        ON personality_types.id = results.personality_type_id
      WHERE (
        results.user_id = $1
        OR runs.user_id = $1
        OR EXISTS (
          SELECT 1
          FROM public.diagnosis_login_conversions conversions
          WHERE conversions.diagnosis_result_id = results.id
            AND conversions.user_id = $1
        )
      )
      AND (
        $3::uuid IS NULL
        OR (
          COALESCE(runs.completed_at, results.created_at),
          results.id
        ) < (
          SELECT
            COALESCE(cursor_runs.completed_at, cursor_results.created_at),
            cursor_results.id
          FROM public.diagnosis_results cursor_results
          JOIN public.diagnosis_runs cursor_runs
            ON cursor_runs.id = cursor_results.diagnosis_run_id
          WHERE cursor_results.id = $3::uuid
        )
      )
      ORDER BY
        COALESCE(runs.completed_at, results.created_at) DESC,
        results.id DESC
      LIMIT $2
    `,
    [args.userId, args.limit, args.cursor || null],
  );

  return result.rows;
}

export async function findJobCategoriesForPersonalityType(
  code: DiagnosisTypeCode,
) {
  const result = await query<{ name: string; reason: string }>(
    `
      SELECT categories.name, mappings.reason
      FROM public.personality_job_category_mappings mappings
      JOIN public.personality_types personality_types
        ON personality_types.id = mappings.personality_type_id
      JOIN public.job_categories categories
        ON categories.id = mappings.job_category_id
      WHERE personality_types.code = $1
        AND categories.is_active = TRUE
      ORDER BY
        mappings.fit_weight DESC,
        mappings.sort_order ASC,
        categories.sort_order ASC
      LIMIT 6
    `,
    [code],
  );

  return result.rows;
}

export async function findDiagnosisPercentile(
  resultId: string,
  typeCode: DiagnosisTypeCode,
) {
  const result = await query<{ top_percent: number | string }>(
    `
      WITH scored AS (
        SELECT
          results.id,
          CASE $2
            WHEN 'stability' THEN results.stability_axis_percent
            WHEN 'challenge' THEN 100 - results.stability_axis_percent
            WHEN 'teamwork' THEN results.teamwork_axis_percent
            WHEN 'individual' THEN 100 - results.teamwork_axis_percent
            WHEN 'execution' THEN results.execution_axis_percent
            WHEN 'planning' THEN 100 - results.execution_axis_percent
            WHEN 'principle' THEN results.principle_axis_percent
            WHEN 'flexibility' THEN 100 - results.principle_axis_percent
          END AS trait_score
        FROM public.diagnosis_results results
      ),
      target AS (
        SELECT trait_score FROM scored WHERE id = $1
      )
      SELECT LEAST(
        100,
        GREATEST(
          1,
          CEIL(
            100.0 * (
              COUNT(*) FILTER (
                WHERE scored.trait_score > (SELECT trait_score FROM target)
              ) + 1
            ) / GREATEST(COUNT(*), 1)
          )
        )
      )::integer AS top_percent
      FROM scored
    `,
    [resultId, typeCode],
  );

  return Number(result.rows[0]?.top_percent || 1);
}

export async function findRecommendedInstitutions(
  typeCode: DiagnosisTypeCode,
  limit: number,
) {
  const result = await query<{ id: string; name: string }>(
    `
      WITH mapped_categories AS (
        SELECT mappings.job_category_id
        FROM public.personality_job_category_mappings mappings
        JOIN public.personality_types personality_types
          ON personality_types.id = mappings.personality_type_id
        JOIN public.job_categories categories
          ON categories.id = mappings.job_category_id
        WHERE personality_types.code = $1
          AND categories.is_active = TRUE
        ORDER BY mappings.fit_weight DESC, mappings.sort_order ASC
        LIMIT 6
      )
      SELECT institutions.id, institutions.name
      FROM public.job_postings postings
      JOIN public.public_institutions institutions
        ON institutions.id = postings.institution_id
      JOIN public.job_posting_categories posting_categories
        ON posting_categories.job_posting_id = postings.id
      JOIN mapped_categories
        ON mapped_categories.job_category_id = posting_categories.job_category_id
      WHERE postings.is_active = TRUE
        AND (postings.application_end_at IS NULL OR postings.application_end_at >= NOW())
      GROUP BY institutions.id, institutions.name
      ORDER BY COUNT(DISTINCT postings.id) DESC, institutions.name ASC
      LIMIT $2
    `,
    [typeCode, limit],
  );

  return result.rows;
}

export async function findMonthlyHiringByPersonalityType(
  typeCode: DiagnosisTypeCode,
) {
  const result = await query<{
    name: string;
    posting_count: number | string;
    total_count: number | string;
  }>(
    `
      WITH mapped_categories AS (
        SELECT categories.id, categories.name, mappings.fit_weight, mappings.sort_order
        FROM public.personality_job_category_mappings mappings
        JOIN public.personality_types personality_types
          ON personality_types.id = mappings.personality_type_id
        JOIN public.job_categories categories
          ON categories.id = mappings.job_category_id
        WHERE personality_types.code = $1
          AND categories.is_active = TRUE
        ORDER BY mappings.fit_weight DESC, mappings.sort_order ASC
        LIMIT 6
      ),
      monthly_postings AS (
        SELECT DISTINCT postings.id, posting_categories.job_category_id
        FROM public.job_postings postings
        JOIN public.job_posting_categories posting_categories
          ON posting_categories.job_posting_id = postings.id
        JOIN mapped_categories
          ON mapped_categories.id = posting_categories.job_category_id
        WHERE COALESCE(postings.announcement_at, postings.created_at)
            >= DATE_TRUNC('month', CURRENT_DATE)
          AND COALESCE(postings.announcement_at, postings.created_at)
            < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      )
      SELECT
        mapped_categories.name,
        COUNT(DISTINCT monthly_postings.id)::integer AS posting_count,
        (
          SELECT COUNT(DISTINCT id)::integer
          FROM monthly_postings
        ) AS total_count
      FROM mapped_categories
      LEFT JOIN monthly_postings
        ON monthly_postings.job_category_id = mapped_categories.id
      GROUP BY
        mapped_categories.id,
        mapped_categories.name,
        mapped_categories.fit_weight,
        mapped_categories.sort_order
      ORDER BY
        mapped_categories.fit_weight DESC,
        mapped_categories.sort_order ASC
    `,
    [typeCode],
  );

  return {
    totalCount: Number(result.rows[0]?.total_count || 0),
    categories: result.rows.map((row) => ({
      name: row.name,
      count: Number(row.posting_count || 0),
    })),
  };
}

export async function createDiagnosisRunWithResult(args: {
  userId?: string;
  questionSetId: string;
  anonymousId?: string;
  entrySource: string;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  answers: { questionId: string; optionId: string; score?: number }[];
  personalityTypeId: string;
  typeCode: DiagnosisTypeCode;
  totalScore: number;
  stabilityScore: number;
  challengeScore: number;
  analyticalScore: number;
  axisScores: {
    stability: number;
    teamwork: number;
    execution: number;
    principle: number;
  };
  summary: string;
  strengths: string[];
  weaknesses: string[];
  rawResult: Record<string, unknown>;
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const run = await client.query<{ id: string }>(
      `
        INSERT INTO public.diagnosis_runs (
          user_id,
          anonymous_id,
          question_set_id,
          entry_source,
          completed_at,
          ip_address,
          user_agent,
          referer
        )
        VALUES ($1, $2, $3, $4::public.entry_source, NOW(), $5, $6, $7)
        RETURNING id
      `,
      [
        args.userId || null,
        args.anonymousId || null,
        args.questionSetId,
        args.entrySource,
        args.ipAddress || null,
        args.userAgent || null,
        args.referer || null,
      ],
    );

    const runId = run.rows[0].id;

    await insertAnswers(client, runId, args.answers);

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO public.diagnosis_results (
          diagnosis_run_id,
          user_id,
          personality_type_id,
          total_score,
          stability_score,
          challenge_score,
          analytical_score,
          stability_axis_percent,
          teamwork_axis_percent,
          execution_axis_percent,
          principle_axis_percent,
          is_stability_oriented,
          is_challenge_oriented,
          is_analytical,
          is_public_service_oriented,
          summary,
          strengths,
          weaknesses,
          raw_result
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17::jsonb,
          $18::jsonb,
          $19::jsonb
        )
        RETURNING id
      `,
      [
        runId,
        args.userId || null,
        args.personalityTypeId,
        args.totalScore,
        args.stabilityScore,
        args.challengeScore,
        args.analyticalScore,
        args.axisScores.stability,
        args.axisScores.teamwork,
        args.axisScores.execution,
        args.axisScores.principle,
        args.typeCode === "stability",
        args.typeCode === "challenge",
        args.typeCode === "planning",
        ["stability", "teamwork", "principle"].includes(args.typeCode),
        args.summary,
        JSON.stringify(args.strengths),
        JSON.stringify(args.weaknesses),
        JSON.stringify(args.rawResult),
      ],
    );

    await client.query("COMMIT");

    return {
      runId,
      resultId: result.rows[0].id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function insertAnswers(
  client: PoolClient,
  runId: string,
  answers: { questionId: string; optionId: string; score?: number }[],
) {
  await client.query(
    `
      INSERT INTO public.diagnosis_answers (
        diagnosis_run_id,
        question_id,
        option_id,
        answer_value
      )
      SELECT
        $1::uuid,
        answer.question_id,
        answer.option_id,
        answer.answer_value
      FROM UNNEST(
        $2::uuid[],
        $3::uuid[],
        $4::integer[]
      ) AS answer(question_id, option_id, answer_value)
    `,
    [
      runId,
      answers.map((answer) => answer.questionId),
      answers.map((answer) => answer.optionId),
      answers.map((answer) => answer.score ?? null),
    ],
  );
}
