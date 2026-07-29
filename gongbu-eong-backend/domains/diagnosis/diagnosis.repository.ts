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
      LIMIT 20
    `,
    [code],
  );

  return result.rows;
}

export async function createDiagnosisRunWithResult(args: {
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
          anonymous_id,
          question_set_id,
          entry_source,
          completed_at,
          ip_address,
          user_agent,
          referer
        )
        VALUES ($1, $2, $3::public.entry_source, NOW(), $4, $5, $6)
        RETURNING id
      `,
      [
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
          $16::jsonb,
          $17::jsonb,
          $18::jsonb
        )
        RETURNING id
      `,
      [
        runId,
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
