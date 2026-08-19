import { db, query } from "@/lib/db";
import {
  COMMUNITY_CATEGORIES,
  type CommunityAttachmentDto,
  type CommunityAuthorDto,
  type CommunityCategory,
  type CommunityCommentDto,
  type CommunityPostDetailDto,
  type CommunityPostSummaryDto,
  type CommunityReportDto,
} from "./community.dto";

type PostRow = {
  id: string;
  category: CommunityCategory;
  title: string;
  content: string;
  image_data_url: string | null;
  view_count: number;
  created_at: Date | string;
  user_id: string;
  author_nickname: string | null;
  author_status_message: string | null;
  author_avatar_key: string | null;
  author_background_color: string | null;
  diagnosis_type_name: string | null;
  recommend_count: string | number;
  scrap_count: string | number;
  comment_count: string | number;
  is_recommended: boolean;
  is_scrapped: boolean;
  attachments: unknown;
  total_count?: string | number;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: Date | string;
  user_id: string;
  author_nickname: string | null;
  author_status_message: string | null;
  author_avatar_key: string | null;
  author_background_color: string | null;
  diagnosis_type_name: string | null;
  can_delete: boolean;
  like_count: string | number;
  dislike_count: string | number;
  my_reaction: "like" | "dislike" | null;
};

type ReportRow = {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  reason: string | null;
  reason_code: string | null;
  reason_detail: string | null;
  status: "pending" | "reviewing" | "resolved" | "rejected";
  target_snapshot: unknown;
  created_at: Date | string;
  reviewed_at: Date | string | null;
  review_note: string | null;
  reporter_id: string;
  reporter_nickname: string | null;
};

export type CommunityPostAttachmentInput = {
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  dataUrl: string;
};

export type CommunityReactionState = {
  recommendCount: number;
  scrapCount: number;
  isRecommended: boolean;
  isScrapped: boolean;
  isBest: boolean;
};

export type ListCommunityPostsInput = {
  category?: string;
  query?: string;
  sort?: "latest" | "popular";
  limit: number;
  offset: number;
  userId?: string;
};

export async function listCommunityPosts(args: ListCommunityPostsInput) {
  const values: unknown[] = [args.userId || null];
  const countValues: unknown[] = [];
  const filters = buildPostFilters(args, values);
  const countFilters = buildPostFilters(args, countValues);
  const orderBy =
    args.sort === "popular"
      ? "recommend_count DESC, comment_count DESC, posts.created_at DESC"
      : "posts.created_at DESC";
  const limitParam = `$${values.push(args.limit)}`;
  const offsetParam = `$${values.push(args.offset)}`;

  const [result, countResult] = await Promise.all([
    query<PostRow>(
      `
        ${postSelectSql({ totalCountExpression: "NULL::text" })}
        WHERE posts.status = 'active'
          ${filters}
        ORDER BY ${orderBy}
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      values,
    ),
    query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM public.community_posts posts
        WHERE posts.status = 'active'
          ${countFilters}
      `,
      countValues,
    ),
  ]);

  return {
    items: result.rows.map(toPostSummary),
    total: Number(countResult.rows[0]?.total_count || 0),
  };
}

export async function listPopularCommunityPosts(userId?: string) {
  const result = await query<PostRow>(
    `
      ${postSelectSql({ totalCountExpression: "NULL::text" })}
      WHERE posts.status = 'active'
      ORDER BY
        recommend_count DESC,
        comment_count DESC,
        posts.view_count DESC,
        posts.created_at DESC
      LIMIT 5
    `,
    [userId || null],
  );

  return result.rows.map(toPostSummary);
}

export async function findCommunityPostById(postId: string, userId?: string) {
  const result = await query<PostRow>(
    `
      ${postSelectSql({ includeAttachments: true, totalCountExpression: "NULL::text" })}
      WHERE posts.id = $2
        AND posts.status = 'active'
      LIMIT 1
    `,
    [userId || null, postId],
  );
  const post = result.rows[0];

  if (!post) return null;

  return {
    ...toPostSummary(post),
    content: post.content,
    comments: await listCommunityComments(post.id, userId),
    canEdit: Boolean(userId && post.user_id === userId),
  } satisfies CommunityPostDetailDto;
}

export async function increaseCommunityPostView(postId: string) {
  await query(
    `UPDATE public.community_posts SET view_count = view_count + 1 WHERE id = $1`,
    [postId],
  );
}

export async function createCommunityPost(
  userId: string,
  input: {
    category: CommunityCategory;
    title: string;
    content: string;
    imageDataUrl?: string | null;
    attachments?: CommunityPostAttachmentInput[];
  },
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO public.community_posts (user_id, category, title, content, image_data_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [userId, input.category, input.title, input.content, input.imageDataUrl || null],
    );
    const postId = result.rows[0].id;
    await replaceCommunityAttachments(client, postId, input.attachments || []);
    await client.query("COMMIT");
    return postId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCommunityPost(
  userId: string,
  postId: string,
  input: {
    category: CommunityCategory;
    title: string;
    content: string;
    imageDataUrl?: string | null;
    attachments?: CommunityPostAttachmentInput[];
  },
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(
      `
        UPDATE public.community_posts
        SET category = $3,
            title = $4,
            content = $5,
            image_data_url = $6,
            updated_at = NOW()
        WHERE id = $2
          AND user_id = $1
          AND status = 'active'
        RETURNING id
      `,
      [userId, postId, input.category, input.title, input.content, input.imageDataUrl || null],
    );

    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }

    await replaceCommunityAttachments(client, postId, input.attachments || []);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCommunityPost(userId: string, postId: string) {
  const result = await query<{ id: string }>(
    `
      UPDATE public.community_posts
      SET status = 'deleted',
          deleted_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
        AND user_id = $1
        AND status = 'active'
      RETURNING id
    `,
    [userId, postId],
  );

  return Boolean(result.rows[0]);
}

export async function setCommunityReaction(
  userId: string,
  postId: string,
  reactionType: "recommend" | "scrap",
  enabled: boolean,
) {
  if (enabled) {
    await query(
      `
        INSERT INTO public.community_post_reactions (post_id, user_id, reaction_type)
        SELECT id, $1, $3
        FROM public.community_posts
        WHERE id = $2
          AND status = 'active'
        ON CONFLICT (post_id, user_id, reaction_type) DO NOTHING
      `,
      [userId, postId, reactionType],
    );
  } else {
    await query(
      `
        DELETE FROM public.community_post_reactions
        WHERE user_id = $1
          AND post_id = $2
          AND reaction_type = $3
      `,
      [userId, postId, reactionType],
    );
  }

  return getCommunityReactionState(userId, postId);
}

async function getCommunityReactionState(
  userId: string,
  postId: string,
): Promise<CommunityReactionState | null> {
  const result = await query<{
    recommend_count: string | number;
    scrap_count: string | number;
    is_recommended: boolean;
    is_scrapped: boolean;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE reactions.reaction_type = 'recommend')::text AS recommend_count,
        COUNT(*) FILTER (WHERE reactions.reaction_type = 'scrap')::text AS scrap_count,
        EXISTS (
          SELECT 1
          FROM public.community_post_reactions mine
          WHERE mine.post_id = posts.id
            AND mine.user_id = $1
            AND mine.reaction_type = 'recommend'
        ) AS is_recommended,
        EXISTS (
          SELECT 1
          FROM public.community_post_reactions mine
          WHERE mine.post_id = posts.id
            AND mine.user_id = $1
            AND mine.reaction_type = 'scrap'
        ) AS is_scrapped
      FROM public.community_posts posts
      LEFT JOIN public.community_post_reactions reactions
        ON reactions.post_id = posts.id
      WHERE posts.id = $2
        AND posts.status = 'active'
      GROUP BY posts.id
      LIMIT 1
    `,
    [userId, postId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const recommendCount = Number(row.recommend_count || 0);

  return {
    recommendCount,
    scrapCount: Number(row.scrap_count || 0),
    isRecommended: Boolean(row.is_recommended),
    isScrapped: Boolean(row.is_scrapped),
    isBest: recommendCount >= 20,
  };
}

export async function listCommunityComments(postId: string, userId?: string) {
  const result = await query<CommentRow>(
    `
      SELECT
        comments.id,
        comments.post_id,
        comments.parent_comment_id,
        comments.content,
        comments.created_at,
        users.id AS user_id,
        COALESCE(users.community_nickname, '공부엉이') AS author_nickname,
        users.profile_status_message AS author_status_message,
        users.profile_avatar_key AS author_avatar_key,
        users.profile_background_color AS author_background_color,
        diagnosis.personality_type_name AS diagnosis_type_name,
        COALESCE(comment_reactions.like_count, 0)::text AS like_count,
        COALESCE(comment_reactions.dislike_count, 0)::text AS dislike_count,
        my_reaction.reaction_type AS my_reaction,
        ($2::uuid IS NOT NULL AND comments.user_id = $2::uuid) AS can_delete
      FROM public.community_comments comments
      JOIN public.users users
        ON users.id = comments.user_id
      LEFT JOIN LATERAL (${diagnosisSql("users")}) diagnosis ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE reaction_type = 'like') AS like_count,
          COUNT(*) FILTER (WHERE reaction_type = 'dislike') AS dislike_count
        FROM public.community_comment_reactions
        WHERE comment_id = comments.id
      ) comment_reactions ON TRUE
      LEFT JOIN LATERAL (
        SELECT reaction_type
        FROM public.community_comment_reactions
        WHERE comment_id = comments.id
          AND user_id = $2::uuid
        LIMIT 1
      ) my_reaction ON $2::uuid IS NOT NULL
      WHERE comments.post_id = $1
        AND comments.status = 'active'
      ORDER BY comments.created_at DESC
    `,
    [postId, userId || null],
  );

  return nestComments(result.rows.map(toComment));
}

export async function createCommunityComment(
  userId: string,
  postId: string,
  content: string,
  parentCommentId?: string | null,
) {
  const result = await query<{ id: string }>(
    `
      WITH RECURSIVE

      target_post AS (
        SELECT id
        FROM public.community_posts
        WHERE id = $2
          AND status = 'active'
      ),

      parent_chain AS (
        SELECT
          comments.id,
          comments.parent_comment_id
        FROM public.community_comments comments
        WHERE comments.id = $4::uuid
          AND comments.post_id = $2
          AND comments.status = 'active'

        UNION ALL

        SELECT
          parent.id,
          parent.parent_comment_id
        FROM public.community_comments parent
        JOIN parent_chain child
          ON parent.id = child.parent_comment_id
        WHERE parent.post_id = $2
          AND parent.status = 'active'
      ),

      root_parent AS (
        SELECT id
        FROM parent_chain
        WHERE parent_comment_id IS NULL
        LIMIT 1
      )

      INSERT INTO public.community_comments (
        post_id,
        user_id,
        parent_comment_id,
        content
      )

      SELECT
        target_post.id,
        $1,
        CASE
          WHEN $4::uuid IS NULL THEN NULL
          ELSE root_parent.id
        END,
        $3

      FROM target_post

      LEFT JOIN root_parent
        ON $4::uuid IS NOT NULL

      WHERE
        $4::uuid IS NULL
        OR root_parent.id IS NOT NULL

      RETURNING id
    `,
    [userId, postId, content, parentCommentId || null],
  );

  return result.rows[0]?.id || null;
}

export async function setCommunityCommentReaction(
  userId: string,
  commentId: string,
  reactionType: "like" | "dislike",
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const target = await client.query<{ id: string }>(
      `
        SELECT id
        FROM public.community_comments
        WHERE id = $1
          AND status = 'active'
        LIMIT 1
      `,
      [commentId],
    );

    if (!target.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const current = await client.query<{ reaction_type: "like" | "dislike" }>(
      `
        SELECT reaction_type
        FROM public.community_comment_reactions
        WHERE comment_id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [commentId, userId],
    );

    if (current.rows[0]?.reaction_type === reactionType) {
      await client.query(
        `
          DELETE FROM public.community_comment_reactions
          WHERE comment_id = $1
            AND user_id = $2
        `,
        [commentId, userId],
      );
    } else {
      await client.query(
        `
          INSERT INTO public.community_comment_reactions (
            comment_id,
            user_id,
            reaction_type
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (comment_id, user_id)
          DO UPDATE SET
            reaction_type = EXCLUDED.reaction_type,
            updated_at = NOW()
        `,
        [commentId, userId, reactionType],
      );
    }

    const state = await getCommunityCommentReactionState(commentId, userId, client);
    await client.query("COMMIT");
    return state;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCommunityCommentReactionState(
  commentId: string,
  userId: string,
  client: Pick<typeof db, "query"> = db,
) {
  const result = await client.query<{
    comment_id: string;
    like_count: string | number;
    dislike_count: string | number;
    my_reaction: "like" | "dislike" | null;
  }>(
    `
      SELECT
        comments.id AS comment_id,
        COUNT(reactions.id) FILTER (WHERE reactions.reaction_type = 'like')::text AS like_count,
        COUNT(reactions.id) FILTER (WHERE reactions.reaction_type = 'dislike')::text AS dislike_count,
        my_reaction.reaction_type AS my_reaction
      FROM public.community_comments comments
      LEFT JOIN public.community_comment_reactions reactions
        ON reactions.comment_id = comments.id
      LEFT JOIN LATERAL (
        SELECT reaction_type
        FROM public.community_comment_reactions
        WHERE comment_id = comments.id
          AND user_id = $2
        LIMIT 1
      ) my_reaction ON TRUE
      WHERE comments.id = $1
        AND comments.status = 'active'
      GROUP BY comments.id, my_reaction.reaction_type
      LIMIT 1
    `,
    [commentId, userId],
  );
  const row = result.rows[0];

  if (!row) return null;

  return {
    commentId: row.comment_id,
    likeCount: Number(row.like_count || 0),
    dislikeCount: Number(row.dislike_count || 0),
    myReaction: row.my_reaction,
  };
}

export async function deleteCommunityComment(userId: string, commentId: string) {
  const result = await query<{ id: string }>(
    `
      UPDATE public.community_comments
      SET status = 'deleted',
          deleted_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
        AND user_id = $1
        AND status = 'active'
      RETURNING id
    `,
    [userId, commentId],
  );

  return Boolean(result.rows[0]);
}

export async function createCommunityReport(
  userId: string,
  targetType: "post" | "comment",
  targetId: string,
  reasonCode: string,
) {
  const snapshot = await getReportTargetSnapshot(targetType, targetId);

  await query(
    `
      INSERT INTO public.community_reports (
        user_id,
        target_type,
        target_id,
        reason,
        reason_code,
        target_snapshot,
        status
      )
      VALUES ($1, $2, $3, $4, $4, $5::jsonb, 'pending')
      ON CONFLICT (user_id, target_type, target_id)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        reason_code = EXCLUDED.reason_code,
        target_snapshot = EXCLUDED.target_snapshot,
        status = 'pending',
        updated_at = NOW()
    `,
    [userId, targetType, targetId, reasonCode, JSON.stringify(snapshot)],
  );
}

export async function listCommunityReports(status?: string) {
  const values: unknown[] = [];
  const statusFilter = ["pending", "reviewing", "resolved", "rejected"].includes(status || "")
    ? `WHERE reports.status = $${values.push(status)}`
    : "";
  const result = await query<ReportRow>(
    `
      SELECT
        reports.id,
        reports.target_type,
        reports.target_id,
        reports.reason,
        reports.reason_code,
        reports.reason_detail,
        reports.status,
        reports.target_snapshot,
        reports.created_at,
        reports.reviewed_at,
        reports.review_note,
        users.id AS reporter_id,
        COALESCE(users.community_nickname, users.nickname, users.display_name, '공부엉이') AS reporter_nickname
      FROM public.community_reports reports
      JOIN public.users users ON users.id = reports.user_id
      ${statusFilter}
      ORDER BY reports.created_at DESC
      LIMIT 100
    `,
    values,
  );

  return result.rows.map(toReport);
}

export async function updateCommunityReport(
  moderatorUserId: string,
  reportId: string,
  input: { status: "pending" | "reviewing" | "resolved" | "rejected"; reviewNote?: string | null },
) {
  const result = await query<ReportRow>(
    `
      UPDATE public.community_reports
      SET status = $2,
          review_note = $3,
          reviewed_by = $4,
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        target_type,
        target_id,
        reason,
        reason_code,
        reason_detail,
        status,
        target_snapshot,
        created_at,
        reviewed_at,
        review_note,
        user_id AS reporter_id,
        NULL::text AS reporter_nickname
    `,
    [reportId, input.status, input.reviewNote || null, moderatorUserId],
  );

  return result.rows[0] ? toReport(result.rows[0]) : null;
}

export async function listCommunityActivity(userId: string) {
  const posts = await query<PostRow>(
    `
      ${postSelectSql()}
      WHERE posts.status = 'active'
        AND posts.user_id = $2
      ORDER BY posts.created_at DESC
      LIMIT 30
    `,
    [userId, userId],
  );
  const comments = await query<CommentRow>(
    `
      SELECT
        comments.id,
        comments.post_id,
        comments.parent_comment_id,
        comments.content,
        comments.created_at,
        users.id AS user_id,
        COALESCE(users.community_nickname, users.nickname, users.display_name, '공부엉이') AS author_nickname,
        users.profile_status_message AS author_status_message,
        users.profile_avatar_key AS author_avatar_key,
        users.profile_background_color AS author_background_color,
        diagnosis.personality_type_name AS diagnosis_type_name,
        0::text AS like_count,
        0::text AS dislike_count,
        NULL::varchar(20) AS my_reaction,
        TRUE AS can_delete
      FROM public.community_comments comments
      JOIN public.users users ON users.id = comments.user_id
      LEFT JOIN LATERAL (${diagnosisSql("users")}) diagnosis ON TRUE
      WHERE comments.user_id = $1
        AND comments.status = 'active'
      ORDER BY comments.created_at DESC
      LIMIT 30
    `,
    [userId],
  );
  const scraps = await query<PostRow>(
    `
      ${postSelectSql()}
      JOIN public.community_post_reactions my_scraps
        ON my_scraps.post_id = posts.id
       AND my_scraps.user_id = $2
       AND my_scraps.reaction_type = 'scrap'
      WHERE posts.status = 'active'
      ORDER BY my_scraps.created_at DESC
      LIMIT 30
    `,
    [userId, userId],
  );

  return {
    posts: posts.rows.map(toPostSummary),
    comments: comments.rows.map(toComment),
    scraps: scraps.rows.map(toPostSummary),
  };
}

export async function logCommunitySearch(userId: string | undefined, searchQuery: string) {
  const trimmed = searchQuery.trim().slice(0, 80);
  if (!trimmed) return;

  await query(
    `
      INSERT INTO public.community_search_logs (user_id, query)
      VALUES ($1, $2)
    `,
    [userId || null, trimmed],
  );
  await query(
    `
      INSERT INTO public.community_search_terms (query, search_count, last_searched_at)
      VALUES ($1, 1, NOW())
      ON CONFLICT (query)
      DO UPDATE SET
        search_count = public.community_search_terms.search_count + 1,
        last_searched_at = NOW(),
        updated_at = NOW()
    `,
    [trimmed],
  );
}

export async function listPopularCommunitySearchQueries() {
  const result = await query<{ query: string }>(
    `
      WITH recent_searches AS (
        SELECT query, created_at
        FROM public.community_search_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT query
      FROM (
        SELECT
          query,
          COUNT(*) AS search_count,
          MIN(created_at) AS first_searched_at
        FROM recent_searches
        GROUP BY query
      ) ranked
      ORDER BY search_count DESC, first_searched_at ASC, query ASC
      LIMIT 6
    `,
  );

  return result.rows.map((row) => row.query);
}

function buildPostFilters(
  args: Pick<ListCommunityPostsInput, "category" | "query">,
  values: unknown[],
) {
  const categoryFilter = isCategory(args.category)
    ? `AND posts.category = $${values.push(args.category)}`
    : "";
  const searchFilter = args.query
    ? `AND (posts.title ILIKE $${values.push(`%${args.query}%`)}
         OR posts.content ILIKE $${values.length})`
    : "";

  return `${categoryFilter} ${searchFilter}`;
}

function postSelectSql(options: {
  includeAttachments?: boolean;
  totalCountExpression?: string;
} = {}) {
  const attachmentsSelect = options.includeAttachments
    ? "COALESCE(attachments.items, '[]'::jsonb)"
    : "'[]'::jsonb";
  const attachmentsJoin = options.includeAttachments
    ? `
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', attachments.id,
          'fileName', attachments.file_name,
          'mimeType', attachments.mime_type,
          'fileSizeBytes', attachments.file_size_bytes,
          'dataUrl', attachments.file_data_url
        )
        ORDER BY attachments.sort_order, attachments.created_at
      ) AS items
      FROM public.community_post_attachments attachments
      WHERE attachments.post_id = posts.id
    ) attachments ON TRUE`
    : "";
  const imageDataSelect = options.includeAttachments
    ? "posts.image_data_url"
    : "NULL::text";
  const totalCountExpression = options.totalCountExpression || "COUNT(*) OVER()::text";

  return `
    SELECT
      posts.id,
      posts.category,
      posts.title,
      posts.content,
      ${imageDataSelect} AS image_data_url,
      posts.view_count,
      posts.created_at,
      posts.user_id,
      COALESCE(users.community_nickname, users.nickname, users.display_name, '공부엉이') AS author_nickname,
      users.profile_status_message AS author_status_message,
      users.profile_avatar_key AS author_avatar_key,
      users.profile_background_color AS author_background_color,
      diagnosis.personality_type_name AS diagnosis_type_name,
      COALESCE(reactions.recommend_count, 0)::text AS recommend_count,
      COALESCE(reactions.scrap_count, 0)::text AS scrap_count,
      COALESCE(comment_counts.comment_count, 0)::text AS comment_count,
      ${attachmentsSelect} AS attachments,
      ${totalCountExpression} AS total_count,
      (
        $1::uuid IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.community_post_reactions mine
          WHERE mine.post_id = posts.id
            AND mine.user_id = $1::uuid
            AND mine.reaction_type = 'recommend'
        )
      ) AS is_recommended,
      (
        $1::uuid IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.community_post_reactions mine
          WHERE mine.post_id = posts.id
            AND mine.user_id = $1::uuid
            AND mine.reaction_type = 'scrap'
        )
      ) AS is_scrapped
    FROM public.community_posts posts
    JOIN public.users users
      ON users.id = posts.user_id
    LEFT JOIN LATERAL (${diagnosisSql("users")}) diagnosis ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE reaction_type = 'recommend') AS recommend_count,
        COUNT(*) FILTER (WHERE reaction_type = 'scrap') AS scrap_count
      FROM public.community_post_reactions
      WHERE post_id = posts.id
    ) reactions ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS comment_count
      FROM public.community_comments
      WHERE post_id = posts.id
        AND status = 'active'
    ) comment_counts ON TRUE
    ${attachmentsJoin}
  `;
}

function diagnosisSql(userAlias: string) {
  return `
    SELECT personality_types.name AS personality_type_name
    FROM public.diagnosis_results results
    JOIN public.diagnosis_runs runs ON runs.id = results.diagnosis_run_id
    JOIN public.personality_types personality_types ON personality_types.id = results.personality_type_id
    WHERE results.user_id = ${userAlias}.id OR runs.user_id = ${userAlias}.id
    ORDER BY runs.completed_at DESC NULLS LAST, results.created_at DESC
    LIMIT 1
  `;
}

async function replaceCommunityAttachments(
  client: Pick<typeof db, "query">,
  postId: string,
  attachments: CommunityPostAttachmentInput[],
) {
  await client.query(`DELETE FROM public.community_post_attachments WHERE post_id = $1`, [postId]);

  for (const [index, attachment] of attachments.entries()) {
    await client.query(
      `
        INSERT INTO public.community_post_attachments (
          post_id,
          file_name,
          mime_type,
          file_size_bytes,
          file_data_url,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        postId,
        attachment.fileName,
        attachment.mimeType,
        attachment.fileSizeBytes,
        attachment.dataUrl,
        index,
      ],
    );
  }
}

async function getReportTargetSnapshot(targetType: "post" | "comment", targetId: string) {
  if (targetType === "post") {
    const result = await query(
      `
        SELECT id, category, title, content, user_id, created_at
        FROM public.community_posts
        WHERE id = $1
      `,
      [targetId],
    );
    return result.rows[0] || null;
  }

  const result = await query(
    `
      SELECT
        comments.id,
        comments.post_id,
        comments.content,
        comments.user_id,
        comments.created_at,
        posts.title AS post_title
      FROM public.community_comments comments
      LEFT JOIN public.community_posts posts ON posts.id = comments.post_id
      WHERE comments.id = $1
    `,
    [targetId],
  );
  return result.rows[0] || null;
}

export function isCategory(value: unknown): value is CommunityCategory {
  return typeof value === "string" && COMMUNITY_CATEGORIES.includes(value as CommunityCategory);
}

function toAuthor(row: Pick<PostRow | CommentRow, "user_id" | "author_nickname" | "author_status_message" | "author_avatar_key" | "author_background_color" | "diagnosis_type_name">): CommunityAuthorDto {
  return {
    id: row.user_id,
    nickname: row.author_nickname || "공부엉이",
    statusMessage: row.author_status_message,
    avatarKey: row.author_avatar_key || "fox",
    backgroundColor: row.author_background_color || "#c4c6ca",
    diagnosisTypeName: row.diagnosis_type_name,
  };
}

function normalizeAttachments(value: unknown, legacyImageUrl?: string | null): CommunityAttachmentDto[] {
  const rows = Array.isArray(value) ? value : [];
  const attachments = rows
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: String(row.id || ""),
        fileName: String(row.fileName || "첨부파일"),
        mimeType: String(row.mimeType || ""),
        fileSizeBytes: Number(row.fileSizeBytes || 0),
        dataUrl: String(row.dataUrl || ""),
      };
    })
    .filter((item): item is CommunityAttachmentDto => Boolean(item?.id && item.dataUrl));

  if (!attachments.length && legacyImageUrl) {
    return [{
      id: "legacy-image",
      fileName: "첨부 이미지",
      mimeType: legacyImageUrl.match(/^data:([^;]+);/)?.[1] || "image/png",
      fileSizeBytes: 0,
      dataUrl: legacyImageUrl,
    }];
  }

  return attachments;
}

function toPostSummary(row: PostRow): CommunityPostSummaryDto {
  const attachments = normalizeAttachments(row.attachments, row.image_data_url);
  const firstImage = attachments.find((item) => item.mimeType.startsWith("image/"))?.dataUrl || row.image_data_url;
  const recommendCount = Number(row.recommend_count || 0);

  return {
    id: row.id,
    category: row.category,
    title: row.title,
    contentPreview: row.content.replace(/\s+/g, " ").slice(0, 96),
    imageUrl: firstImage,
    attachments,
    author: toAuthor(row),
    viewCount: Number(row.view_count || 0),
    recommendCount,
    commentCount: Number(row.comment_count || 0),
    scrapCount: Number(row.scrap_count || 0),
    isRecommended: Boolean(row.is_recommended),
    isScrapped: Boolean(row.is_scrapped),
    isBest: recommendCount >= 20,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toComment(row: CommentRow): CommunityCommentDto {
  return {
    id: row.id,
    postId: row.post_id,
    parentCommentId: row.parent_comment_id,
    content: row.content,
    author: toAuthor(row),
    createdAt: new Date(row.created_at).toISOString(),
    canDelete: Boolean(row.can_delete),
    likeCount: Number(row.like_count || 0),
    dislikeCount: Number(row.dislike_count || 0),
    myReaction: row.my_reaction,
    replies: [],
  };
}

function nestComments(comments: CommunityCommentDto[]) {
  const byId = new Map<string, CommunityCommentDto>();
  const roots: CommunityCommentDto[] = [];

  for (const comment of comments) {
    comment.replies = [];
    byId.set(comment.id, comment);
  }

  // 먼저 원댓글만 찾음
  for (const comment of comments) {
    if (!comment.parentCommentId) {
      roots.push(comment);
    }
  }

  // 모든 대댓글을 최상위 원댓글 바로 아래에 연결
  for (const comment of comments) {
    if (!comment.parentCommentId) {
      continue;
    }

    let parent = byId.get(comment.parentCommentId);

    const visited = new Set<string>();

    while (parent?.parentCommentId) {
      if (visited.has(parent.id)) {
        break;
      }

      visited.add(parent.id);

      const nextParent = byId.get(parent.parentCommentId);

      if (!nextParent) {
        break;
      }

      parent = nextParent;
    }

    if (parent) {
      parent.replies.push(comment);
    }
  }

  // 대댓글 최신순
  for (const root of roots) {
    root.replies.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime()
    );
  }

  // 원댓글은 원댓글 자체의 작성시간 기준 최신순
  roots.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() -
      new Date(left.createdAt).getTime()
  );

  return roots;
}

function getThreadLatestTime(comment: CommunityCommentDto): number {
  return Math.max(
    new Date(comment.createdAt).getTime(),
    ...comment.replies.map(getThreadLatestTime),
  );
}

function sortRepliesByLatest(comment: CommunityCommentDto) {
  comment.replies.sort((left, right) => getThreadLatestTime(right) - getThreadLatestTime(left));
  comment.replies.forEach(sortRepliesByLatest);
}

function toReport(row: ReportRow): CommunityReportDto {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    reasonCode: row.reason_code,
    reasonDetail: row.reason_detail,
    status: row.status,
    targetSnapshot: row.target_snapshot,
    reporter: {
      id: row.reporter_id,
      nickname: row.reporter_nickname || "공부엉이",
    },
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    reviewNote: row.review_note,
  };
}
