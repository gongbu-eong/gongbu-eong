import { db } from "@/lib/db";
import type { PoolClient } from "pg";
import type {
  ResumeDto,
  ResumeEntryDto,
  ResumeParseJobDto,
  ResumePayloadDto,
} from "./resumes.dto";

type ResumeRow = {
  id: string;
  user_id: string;
  user_file_id: string | null;
  source_type: "upload" | "manual";
  title: string;
  name: string | null;
  birth_year: string | null;
  birth_date: string | null;
  email: string | null;
  desired_job: string | null;
  highest_education: string | null;
  gpa: string | null;
  gpa_score: string | null;
  gpa_max: string | null;
  school_major: string | null;
  graduation_status: string | null;
  education_start_date: string | null;
  education_end_date: string | null;
  education_summary: string | null;
  career_summary: string | null;
  certification_summary: string | null;
  completion_percent: number;
  is_selected: boolean;
  extracted_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  file_id: string | null;
  original_filename: string | null;
  content_type: string | null;
  size_bytes: string | null;
  public_url: string | null;
};

type ResumeParseJobRow = {
  id: string;
  user_id: string;
  user_file_id: string;
  status: ResumeParseJobDto["status"];
  extracted_payload: Partial<ResumePayloadDto> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type EntryRow = {
  id: string;
  title: string;
  subtitle: string | null;
  start_date: string | null;
  end_date: string | null;
  school_name?: string | null;
  degree?: string | null;
  major?: string | null;
  gpa_score?: string | null;
  gpa_max?: string | null;
  graduation_status?: string | null;
  company_name?: string | null;
  position?: string | null;
  duties?: string | null;
  contest_name?: string | null;
  award_name?: string | null;
  awarded_date?: string | null;
  issuer?: string | null;
  activity_name?: string | null;
  description?: string | null;
  activity_date?: string | null;
  language_name?: string | null;
  test_name?: string | null;
  level_or_score?: string | null;
  acquired_date?: string | null;
};

export async function listResumes(userId: string) {
  const result = await db.query<ResumeRow>(
    `
      SELECT
        resumes.*,
        files.id AS file_id,
        files.original_filename,
        files.content_type,
        files.size_bytes,
        files.public_url
      FROM public.user_resumes resumes
      LEFT JOIN public.user_files files
        ON files.id = resumes.user_file_id
      WHERE resumes.user_id = $1
      ORDER BY resumes.is_selected DESC, resumes.created_at DESC
    `,
    [userId],
  );

  return Promise.all(result.rows.map(mapResumeWithEntries));
}

export async function findResume(userId: string, resumeId: string) {
  const result = await db.query<ResumeRow>(
    `
      SELECT
        resumes.*,
        files.id AS file_id,
        files.original_filename,
        files.content_type,
        files.size_bytes,
        files.public_url
      FROM public.user_resumes resumes
      LEFT JOIN public.user_files files
        ON files.id = resumes.user_file_id
      WHERE resumes.user_id = $1
        AND resumes.id = $2
      LIMIT 1
    `,
    [userId, resumeId],
  );

  const row = result.rows[0];
  return row ? mapResumeWithEntries(row) : null;
}

export async function createResume(userId: string, payload: ResumePayloadDto) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await lockResumeTitle(client, userId);

    const title = await resolveUniqueResumeTitle(
      client,
      userId,
      normalizeText(payload.title) || "이력서",
    );

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO public.user_resumes (
          user_id,
          user_file_id,
          source_type,
          title,
          name,
          birth_year,
          birth_date,
          email,
          desired_job,
          highest_education,
          gpa,
          gpa_score,
          gpa_max,
          school_major,
          graduation_status,
          education_start_date,
          education_end_date,
          education_summary,
          career_summary,
          certification_summary,
          completion_percent,
          extracted_payload
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        RETURNING id
      `,
      [
        userId,
        payload.fileId || null,
        payload.sourceType,
        title,
        normalizeText(payload.name),
        normalizeText(payload.birthYear),
        normalizeText(payload.birthDate),
        normalizeText(payload.email),
        normalizeText(payload.desiredJob),
        normalizeText(payload.highestEducation),
        normalizeText(payload.gpa),
        normalizeText(payload.gpaScore),
        normalizeText(payload.gpaMax),
        normalizeText(payload.schoolMajor),
        normalizeText(payload.graduationStatus),
        normalizeText(payload.educationStartDate),
        normalizeText(payload.educationEndDate),
        normalizeText(payload.educationSummary),
        normalizeText(payload.careerSummary),
        normalizeText(payload.certificationSummary),
        payload.completionPercent ?? calculateCompletion(payload),
        JSON.stringify(payload.extractedPayload || {}),
      ],
    );

    await replaceEntries(client, result.rows[0].id, payload);
    await client.query("COMMIT");

    return findResume(userId, result.rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateResume(userId: string, resumeId: string, payload: ResumePayloadDto) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await lockResumeTitle(client, userId);

    const title = await resolveUniqueResumeTitle(
      client,
      userId,
      normalizeText(payload.title) || "이력서",
      resumeId,
    );

    await client.query(
      `
        UPDATE public.user_resumes
        SET
          title = $3,
          user_file_id = $4,
          source_type = $5,
          name = $6,
          birth_year = $7,
          birth_date = $8,
          email = $9,
          desired_job = $10,
          highest_education = $11,
          gpa = $12,
          gpa_score = $13,
          gpa_max = $14,
          school_major = $15,
          graduation_status = $16,
          education_start_date = $17,
          education_end_date = $18,
          education_summary = $19,
          career_summary = $20,
          certification_summary = $21,
          completion_percent = $22,
          extracted_payload = COALESCE($23::jsonb, extracted_payload),
          updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
      `,
      [
        userId,
        resumeId,
        title,
        payload.fileId || null,
        payload.sourceType,
        normalizeText(payload.name),
        normalizeText(payload.birthYear),
        normalizeText(payload.birthDate),
        normalizeText(payload.email),
        normalizeText(payload.desiredJob),
        normalizeText(payload.highestEducation),
        normalizeText(payload.gpa),
        normalizeText(payload.gpaScore),
        normalizeText(payload.gpaMax),
        normalizeText(payload.schoolMajor),
        normalizeText(payload.graduationStatus),
        normalizeText(payload.educationStartDate),
        normalizeText(payload.educationEndDate),
        normalizeText(payload.educationSummary),
        normalizeText(payload.careerSummary),
        normalizeText(payload.certificationSummary),
        payload.completionPercent ?? calculateCompletion(payload),
        JSON.stringify(payload.extractedPayload || {}),
      ],
    );

    await replaceEntries(client, resumeId, payload);
    await client.query("COMMIT");

    return findResume(userId, resumeId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteResume(userId: string, resumeId: string) {
  await db.query(
    `
      DELETE FROM public.user_resumes
      WHERE user_id = $1
        AND id = $2
    `,
    [userId, resumeId],
  );
}

export async function selectResume(userId: string, resumeId: string) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE public.user_resumes SET is_selected = FALSE WHERE user_id = $1`,
      [userId],
    );
    await client.query(
      `
        UPDATE public.user_resumes
        SET is_selected = TRUE, updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
      `,
      [userId, resumeId],
    );
    await client.query(
      `
        UPDATE public.users
        SET selected_resume_id = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [userId, resumeId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createUserFile(args: {
  userId: string;
  originalFilename: string;
  storageObjectKey: string;
  publicUrl?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  uploadStatus?: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await db.query<{
    id: string;
    original_filename: string;
    content_type: string | null;
    size_bytes: string | null;
    public_url: string | null;
  }>(
    `
      INSERT INTO public.user_files (
        user_id,
        original_filename,
        storage_object_key,
        public_url,
        content_type,
        size_bytes,
        upload_status,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, original_filename, content_type, size_bytes, public_url
    `,
    [
      args.userId,
      args.originalFilename,
      args.storageObjectKey,
      args.publicUrl || null,
      args.contentType || null,
      args.sizeBytes || null,
      args.uploadStatus || "uploaded",
      JSON.stringify(args.metadata || {}),
    ],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
    publicUrl: row.public_url,
  };
}

export async function updateUserFileStorage(args: {
  userId: string;
  fileId: string;
  originalFilename: string;
  storageObjectKey: string;
  publicUrl?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  uploadStatus?: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await db.query<{
    id: string;
    original_filename: string;
    content_type: string | null;
    size_bytes: string | null;
    public_url: string | null;
  }>(
    `
      UPDATE public.user_files
      SET
        original_filename = $3,
        storage_object_key = $4,
        public_url = $5,
        content_type = $6,
        size_bytes = $7,
        upload_status = $8,
        metadata = COALESCE(metadata, '{}'::jsonb) || $9::jsonb
      WHERE user_id = $1
        AND id = $2
      RETURNING id, original_filename, content_type, size_bytes, public_url
    `,
    [
      args.userId,
      args.fileId,
      args.originalFilename,
      args.storageObjectKey,
      args.publicUrl || null,
      args.contentType || null,
      args.sizeBytes || null,
      args.uploadStatus || "uploaded",
      JSON.stringify(args.metadata || {}),
    ],
  );

  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        originalFilename: row.original_filename,
        contentType: row.content_type,
        sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
        publicUrl: row.public_url,
      }
    : null;
}

export async function createResumeParseJob(userId: string, fileId: string) {
  const result = await db.query<ResumeParseJobRow>(
    `
      INSERT INTO public.resume_parse_jobs (
        user_id,
        user_file_id,
        status
      )
      VALUES ($1, $2, 'pending')
      RETURNING *
    `,
    [userId, fileId],
  );

  return mapResumeParseJob(result.rows[0]);
}

export async function markResumeParseJobProcessing(userId: string, jobId: string) {
  const result = await db.query<ResumeParseJobRow>(
    `
      UPDATE public.resume_parse_jobs
      SET status = 'processing',
          started_at = COALESCE(started_at, NOW()),
          updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING *
    `,
    [userId, jobId],
  );

  return result.rows[0] ? mapResumeParseJob(result.rows[0]) : null;
}

export async function completeResumeParseJob(
  userId: string,
  jobId: string,
  extractedPayload: Partial<ResumePayloadDto>,
) {
  const result = await db.query<ResumeParseJobRow>(
    `
      UPDATE public.resume_parse_jobs
      SET status = 'completed',
          extracted_payload = $3::jsonb,
          error_message = NULL,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING *
    `,
    [userId, jobId, JSON.stringify(extractedPayload || {})],
  );

  return result.rows[0] ? mapResumeParseJob(result.rows[0]) : null;
}

export async function failResumeParseJob(userId: string, jobId: string, errorMessage: string) {
  const result = await db.query<ResumeParseJobRow>(
    `
      UPDATE public.resume_parse_jobs
      SET status = 'failed',
          error_message = $3,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING *
    `,
    [userId, jobId, errorMessage],
  );

  return result.rows[0] ? mapResumeParseJob(result.rows[0]) : null;
}

export async function findResumeParseJob(userId: string, jobId: string) {
  const result = await db.query<ResumeParseJobRow>(
    `
      SELECT *
      FROM public.resume_parse_jobs
      WHERE user_id = $1
        AND id = $2
      LIMIT 1
    `,
    [userId, jobId],
  );

  return result.rows[0] ? mapResumeParseJob(result.rows[0]) : null;
}

function mapResume(row: ResumeRow): ResumeDto {
  return {
    id: row.id,
    userId: row.user_id,
    fileId: row.user_file_id,
    sourceType: row.source_type,
    title: row.title,
    name: row.name,
    birthYear: row.birth_year,
    birthDate: row.birth_date,
    email: row.email,
    desiredJob: row.desired_job,
    highestEducation: row.highest_education,
    gpa: row.gpa,
    gpaScore: row.gpa_score,
    gpaMax: row.gpa_max,
    schoolMajor: row.school_major,
    graduationStatus: row.graduation_status,
    educationStartDate: row.education_start_date,
    educationEndDate: row.education_end_date,
    educationSummary: row.education_summary,
    careerSummary: row.career_summary,
    certificationSummary: row.certification_summary,
    completionPercent: row.completion_percent,
    isSelected: row.is_selected,
    extractedPayload: row.extracted_payload || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    educations: [],
    experiences: [],
    certifications: [],
    file: row.file_id
      ? {
          id: row.file_id,
          originalFilename: row.original_filename || "",
          contentType: row.content_type,
          sizeBytes: row.size_bytes ? Number(row.size_bytes) : null,
          publicUrl: row.public_url,
        }
      : null,
  };
}

function mapResumeParseJob(row: ResumeParseJobRow): ResumeParseJobDto {
  return {
    id: row.id,
    userId: row.user_id,
    fileId: row.user_file_id,
    status: row.status,
    extractedPayload: row.extracted_payload || null,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapResumeWithEntries(row: ResumeRow): Promise<ResumeDto> {
  const resume = mapResume(row);
  const [educations, experiences, certifications, awards, activities, languages] = await Promise.all([
    db.query<EntryRow>(
      `
        SELECT id, school_name AS title, major AS subtitle, school_name, degree, major,
               gpa_score, gpa_max, graduation_status, start_date, end_date
        FROM public.user_resume_educations
        WHERE resume_id = $1
        ORDER BY sort_order, id
      `,
      [row.id],
    ),
    db.query<EntryRow>(
      `
        SELECT id, company_name AS title, COALESCE(position, role, description) AS subtitle,
               company_name, position, duties, start_date, end_date
        FROM public.user_resume_experiences
        WHERE resume_id = $1
        ORDER BY sort_order, id
      `,
      [row.id],
    ),
    db.query<EntryRow>(
      `
        SELECT id, certificate_name AS title, issuer AS subtitle, acquired_year AS start_date,
               NULL::text AS end_date, acquired_date
        FROM public.user_resume_certifications
        WHERE resume_id = $1
        ORDER BY sort_order, id
      `,
      [row.id],
    ),
    db.query<EntryRow>(`SELECT id, contest_name AS title, award_name AS subtitle, awarded_date AS start_date, NULL::text AS end_date, contest_name, award_name, issuer, awarded_date FROM public.user_resume_awards WHERE resume_id = $1 ORDER BY sort_order, id`, [row.id]),
    db.query<EntryRow>(`SELECT id, activity_name AS title, description AS subtitle, COALESCE(activity_date, start_date) AS start_date, end_date, activity_name, description, issuer, activity_date FROM public.user_resume_activities WHERE resume_id = $1 ORDER BY sort_order, id`, [row.id]),
    db.query<EntryRow>(`SELECT id, COALESCE(test_name, language_name) AS title, CONCAT_WS(' · ', NULLIF(language_name, ''), level_or_score, acquired_date, issuer) AS subtitle, acquired_date AS start_date, NULL::text AS end_date, language_name, test_name, level_or_score, issuer, acquired_date FROM public.user_resume_languages WHERE resume_id = $1 ORDER BY sort_order, id`, [row.id]),
  ]);

  resume.educations = educations.rows.map(mapEntry);
  resume.experiences = experiences.rows.map(mapEntry);
  resume.certifications = certifications.rows.map(mapEntry);
  resume.awards = awards.rows.map(mapEntry);
  resume.activities = activities.rows.map(mapEntry);
  resume.languages = languages.rows.map(mapEntry);
  return resume;
}

function mapEntry(row: EntryRow): ResumeEntryDto {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || undefined,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    schoolName: row.school_name || undefined,
    degree: row.degree || undefined,
    major: row.major || undefined,
    gpaScore: row.gpa_score || undefined,
    gpaMax: row.gpa_max || undefined,
    graduationStatus: row.graduation_status || undefined,
    companyName: row.company_name || undefined,
    position: row.position || undefined,
    duties: row.duties || undefined,
    contestName: row.contest_name || undefined,
    awardName: row.award_name || undefined,
    awardedDate: row.awarded_date || undefined,
    issuer: row.issuer || undefined,
    activityName: row.activity_name || undefined,
    description: row.description || undefined,
    activityDate: row.activity_date || undefined,
    language: row.language_name || undefined,
    testName: row.test_name || undefined,
    levelOrScore: row.level_or_score || undefined,
    acquiredDate: row.acquired_date || undefined,
  };
}

async function replaceEntries(
  client: PoolClient,
  resumeId: string,
  payload: ResumePayloadDto,
) {
  await client.query(`DELETE FROM public.user_resume_educations WHERE resume_id = $1`, [resumeId]);
  await client.query(`DELETE FROM public.user_resume_experiences WHERE resume_id = $1`, [resumeId]);
  await client.query(`DELETE FROM public.user_resume_certifications WHERE resume_id = $1`, [resumeId]);
  await client.query(`DELETE FROM public.user_resume_awards WHERE resume_id = $1`, [resumeId]);
  await client.query(`DELETE FROM public.user_resume_activities WHERE resume_id = $1`, [resumeId]);
  await client.query(`DELETE FROM public.user_resume_languages WHERE resume_id = $1`, [resumeId]);

  await Promise.all(
    (payload.educations || []).map((entry, index) =>
      client.query(
        `
          INSERT INTO public.user_resume_educations (
            resume_id, school_name, major, degree, graduation_status, gpa_score, gpa_max, start_date, end_date, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          resumeId,
          normalizeText(entry.title) || "학교",
          normalizeText(entry.major || entry.subtitle),
          normalizeText(entry.degree),
          normalizeText(entry.graduationStatus),
          normalizeText(entry.gpaScore),
          normalizeText(entry.gpaMax),
          normalizeText(entry.startDate),
          normalizeText(entry.endDate),
          index + 1,
        ],
      ),
    ),
  );

  await Promise.all(
    (payload.experiences || []).map((entry, index) =>
      client.query(
        `
          INSERT INTO public.user_resume_experiences (
            resume_id, company_name, role, description, position, duties, start_date, end_date, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          resumeId,
          normalizeText(entry.title) || "경력",
          normalizeText(entry.position || entry.subtitle),
          normalizeText(entry.duties),
          normalizeText(entry.position || entry.subtitle),
          normalizeText(entry.duties),
          normalizeText(entry.startDate),
          normalizeText(entry.endDate),
          index + 1,
        ],
      ),
    ),
  );

  await Promise.all(
    (payload.certifications || []).map((entry, index) =>
      client.query(
        `
          INSERT INTO public.user_resume_certifications (
            resume_id, certificate_name, issuer, acquired_year, acquired_date, sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          resumeId,
          normalizeText(entry.certificationName || entry.title) || "자격증",
          normalizeText(entry.issuer || entry.subtitle),
          normalizeText(entry.acquiredDate || entry.startDate),
          normalizeText(entry.acquiredDate || entry.startDate),
          index + 1,
        ],
      ),
    ),
  );

  await Promise.all((payload.awards || []).map((entry, index) => client.query(`INSERT INTO public.user_resume_awards (resume_id, contest_name, award_name, issuer, awarded_date, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`, [resumeId, normalizeText(entry.contestName || entry.title) || "수상", normalizeText(entry.awardName || entry.subtitle), normalizeText(entry.issuer), normalizeText(entry.awardedDate || entry.startDate), index + 1])));
  await Promise.all((payload.activities || []).map((entry, index) => client.query(`INSERT INTO public.user_resume_activities (resume_id, activity_name, description, issuer, activity_date, start_date, end_date, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [resumeId, normalizeText(entry.activityName || entry.title) || "", normalizeText(entry.description || entry.subtitle), normalizeText(entry.issuer), normalizeText(entry.activityDate), normalizeText(entry.startDate), normalizeText(entry.endDate), index + 1])));
  await Promise.all((payload.languages || []).map((entry, index) => client.query(`INSERT INTO public.user_resume_languages (resume_id, language_name, test_name, level_or_score, issuer, acquired_date, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [resumeId, normalizeText(entry.language), normalizeText(entry.testName || entry.title), normalizeText(entry.levelOrScore || entry.subtitle), normalizeText(entry.issuer), normalizeText(entry.acquiredDate || entry.startDate), index + 1])));
}

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function lockResumeTitle(client: PoolClient, userId: string) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `user_resume_title:${userId}`,
  ]);
}

async function resolveUniqueResumeTitle(
  client: PoolClient,
  userId: string,
  requestedTitle: string,
  excludeResumeId?: string,
) {
  const baseTitle = normalizeText(requestedTitle) || "이력서";
  const params = excludeResumeId ? [userId, excludeResumeId] : [userId];
  const result = await client.query<{ title: string }>(
    `
      SELECT title
      FROM public.user_resumes
      WHERE user_id = $1
      ${excludeResumeId ? "AND id <> $2" : ""}
    `,
    params,
  );

  const usedTitles = new Set(result.rows.map((row) => row.title));
  if (!usedTitles.has(baseTitle)) {
    return baseTitle;
  }

  let suffix = 1;
  while (usedTitles.has(`${baseTitle}(${suffix})`)) {
    suffix += 1;
  }

  return `${baseTitle}(${suffix})`;
}

function calculateCompletion(payload: ResumePayloadDto) {
  const fields = [
    payload.title,
    payload.name,
    payload.birthYear,
    payload.email,
    payload.desiredJob,
    payload.highestEducation,
    payload.gpa,
    payload.schoolMajor,
  ];
  const filled = fields.filter((field) => normalizeText(field)).length;
  const listFilled = [
    payload.educations?.length,
    payload.experiences?.length,
    payload.certifications?.length,
  ].filter(Boolean).length;

  return Math.min(100, Math.round(((filled + listFilled) / 11) * 100));
}
