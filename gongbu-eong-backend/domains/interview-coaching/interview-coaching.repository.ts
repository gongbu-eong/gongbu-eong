import { db } from "@/lib/db";
import type {
  InterviewAnalysis,
  InterviewAnswerFeedback,
  InterviewCoachingJobDto,
  InterviewCoachingResult,
  InterviewCoachingSessionDto,
  InterviewCoachingStatus,
  InterviewMessage,
  InterviewMessageRole,
  InterviewQuestion,
} from "./interview-coaching.dto";

type SessionRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  job_posting_id: string | null;
  status: InterviewCoachingStatus | null;
  last_error_message: string | null;
  company_name: string | null;
  position_name: string | null;
  duty_text: string | null;
  job_snapshot: InterviewCoachingJobDto | null;
  analysis: InterviewAnalysis | null;
  questions: InterviewQuestion[] | null;
  result: InterviewCoachingResult | null;
  started_at: string;
  completed_at: string | null;
};

type MessageRow = {
  id: string;
  question_id: string | null;
  role: InterviewMessageRole;
  content: string;
  follow_up_index: number | null;
  feedback: InterviewAnswerFeedback | null;
  created_at: string;
};

export async function createInterviewSession(args: {
  userId?: string | null;
  anonymousId?: string | null;
  jobPostingId?: string | null;
  jobSnapshot?: InterviewCoachingJobDto | null;
  companyName: string;
  positionName: string;
  dutyText: string;
  analysis?: InterviewAnalysis | null;
  questions?: InterviewQuestion[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const result = await db.query<{ id: string }>(
    `
      INSERT INTO public.interview_coaching_sessions (
        user_id,
        anonymous_id,
        job_posting_id,
        entry_source,
        ip_address,
        user_agent,
        status,
        company_name,
        position_name,
        duty_text,
        job_snapshot,
        analysis,
        questions
      )
      VALUES ($1, $2, $3, 'ai_tools', $4, $5, 'draft', $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
      RETURNING id
    `,
    [
      args.userId || null,
      args.userId ? null : args.anonymousId || null,
      args.jobPostingId || null,
      args.ipAddress || null,
      args.userAgent || null,
      args.companyName,
      args.positionName,
      args.dutyText,
      JSON.stringify(args.jobSnapshot || {}),
      JSON.stringify(args.analysis || {}),
      JSON.stringify(args.questions || []),
    ],
  );

  return result.rows[0].id;
}

export async function updateInterviewSessionAnalysis(args: {
  sessionId: string;
  companyName: string;
  positionName: string;
  dutyText: string;
  analysis: InterviewAnalysis;
  questions: InterviewQuestion[];
}) {
  await db.query(
    `
      UPDATE public.interview_coaching_sessions
      SET status = 'ready',
          last_error_message = NULL,
          company_name = $2,
          position_name = $3,
          duty_text = $4,
          analysis = $5::jsonb,
          questions = $6::jsonb,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [
      args.sessionId,
      args.companyName,
      args.positionName,
      args.dutyText,
      JSON.stringify(args.analysis),
      JSON.stringify(args.questions),
    ],
  );
}

export async function markInterviewSessionFailed(
  sessionId: string,
  message: string,
) {
  await db.query(
    `
      UPDATE public.interview_coaching_sessions
      SET status = 'failed',
          last_error_message = $2,
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [sessionId, message.slice(0, 500)],
  );
}

export async function findInterviewSessionForViewer(args: {
  sessionId: string;
  userId?: string | null;
  anonymousId?: string | null;
}) {
  const result = await db.query<SessionRow>(
    `
      SELECT
        id,
        user_id,
        anonymous_id,
        job_posting_id,
        status,
        last_error_message,
        company_name,
        position_name,
        duty_text,
        job_snapshot,
        analysis,
        questions,
        result,
        started_at,
        completed_at
      FROM public.interview_coaching_sessions
      WHERE id = $1
        AND (
          ($2::uuid IS NOT NULL AND user_id = $2::uuid)
          OR (
            $3::uuid IS NOT NULL
            AND user_id IS NULL
            AND anonymous_id = $3::uuid
          )
        )
      LIMIT 1
    `,
    [args.sessionId, args.userId || null, args.anonymousId || null],
  );
  const row = result.rows[0];
  if (!row) return null;

  const messages = await listInterviewMessages(row.id);
  return mapSession(row, messages);
}

export async function listInterviewHistory(userId: string) {
  const result = await db.query<SessionRow>(
    `
      SELECT
        id,
        user_id,
        anonymous_id,
        job_posting_id,
        status,
        last_error_message,
        company_name,
        position_name,
        duty_text,
        job_snapshot,
        analysis,
        questions,
        result,
        started_at,
        completed_at
      FROM public.interview_coaching_sessions
      WHERE user_id = $1::uuid
      ORDER BY started_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => mapSession(row, []));
}

export async function claimAnonymousInterviewSessions(
  userId: string,
  anonymousId?: string | null,
) {
  if (!anonymousId) return 0;
  const result = await db.query<{ id: string }>(
    `
      UPDATE public.interview_coaching_sessions
      SET user_id = $1::uuid,
          updated_at = NOW()
      WHERE user_id IS NULL
        AND anonymous_id = $2::uuid
      RETURNING id
    `,
    [userId, anonymousId],
  );
  return result.rowCount || 0;
}

export async function addInterviewMessage(args: {
  sessionId: string;
  questionId?: string | null;
  role: InterviewMessageRole;
  content: string;
  followUpIndex?: number | null;
  feedback?: InterviewAnswerFeedback | null;
}) {
  const result = await db.query<MessageRow>(
    `
      INSERT INTO public.interview_coaching_messages (
        session_id,
        message_order,
        question_id,
        role,
        content,
        follow_up_index,
        feedback
      )
      SELECT
        $1::uuid,
        COALESCE(MAX(message_order), 0) + 1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb
      FROM public.interview_coaching_messages
      WHERE session_id = $1::uuid
      RETURNING id, question_id, role, content, follow_up_index, feedback, created_at
    `,
    [
      args.sessionId,
      args.questionId || null,
      args.role,
      args.content,
      args.followUpIndex || null,
      JSON.stringify(args.feedback || null),
    ],
  );

  return mapMessage(result.rows[0]);
}

export async function updateInterviewMessageFeedback(
  messageId: string,
  feedback: InterviewAnswerFeedback,
) {
  await db.query(
    `
      UPDATE public.interview_coaching_messages
      SET feedback = $2::jsonb
      WHERE id = $1::uuid
    `,
    [messageId, JSON.stringify(feedback)],
  );
}

export async function updateInterviewResult(
  sessionId: string,
  result: InterviewCoachingResult,
) {
  await db.query(
    `
      UPDATE public.interview_coaching_sessions
      SET status = 'completed',
          result = $2::jsonb,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1::uuid
    `,
    [sessionId, JSON.stringify(result)],
  );
}

async function listInterviewMessages(sessionId: string) {
  const result = await db.query<MessageRow>(
    `
      SELECT
        id,
        question_id,
        role,
        content,
        follow_up_index,
        feedback,
        created_at
      FROM public.interview_coaching_messages
      WHERE session_id = $1::uuid
      ORDER BY message_order, created_at
    `,
    [sessionId],
  );

  return result.rows.map(mapMessage);
}

function mapSession(
  row: SessionRow,
  messages: InterviewMessage[],
): InterviewCoachingSessionDto {
  return {
    id: row.id,
    status: row.status || (row.completed_at ? "completed" : "ready"),
    lastErrorMessage: row.last_error_message || null,
    createdAt: row.started_at,
    completedAt: row.completed_at,
    companyName: row.company_name || "",
    positionName: row.position_name || "",
    dutyText: row.duty_text || "",
    job: row.job_snapshot?.id ? row.job_snapshot : null,
    analysis: normalizeAnalysis(row),
    questions: Array.isArray(row.questions) ? row.questions : [],
    messages,
    result: row.result || null,
    isAnonymous: !row.user_id && Boolean(row.anonymous_id),
  };
}

function normalizeAnalysis(row: SessionRow): InterviewAnalysis {
  const analysis = row.analysis;
  const profile = analysis?.profile;
  return {
    profile: {
      companyName: profile?.companyName || row.company_name || "",
      positionName: profile?.positionName || row.position_name || "",
      dutyText: profile?.dutyText || row.duty_text || "",
      mainTasks: Array.isArray(profile?.mainTasks) ? profile.mainTasks : [],
      requiredKnowledge: Array.isArray(profile?.requiredKnowledge)
        ? profile.requiredKnowledge
        : [],
      preferredExperience: Array.isArray(profile?.preferredExperience)
        ? profile.preferredExperience
        : [],
      keywords: Array.isArray(profile?.keywords) ? profile.keywords : [],
    },
    ncsMappings: Array.isArray(analysis?.ncsMappings) ? analysis.ncsMappings : [],
    questionPlan: Array.isArray(analysis?.questionPlan) ? analysis.questionPlan : [],
  };
}

function mapMessage(row: MessageRow): InterviewMessage {
  return {
    id: row.id,
    questionId: row.question_id,
    role: row.role,
    content: row.content,
    followUpIndex: row.follow_up_index,
    feedback: row.feedback || null,
    createdAt: row.created_at,
  };
}
