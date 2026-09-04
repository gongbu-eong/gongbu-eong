import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import {
  grantCommunityActivityMilestoneReward,
} from "@/domains/credits/credits.repository";
import { notifyCommunityComment } from "@/domains/notifications/notifications.repository";
import type { NextRequest } from "next/server";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
} from "./community.dto";
import {
  createCommunityComment,
  createCommunityPost,
  createCommunityReport,
  deleteCommunityComment,
  deleteCommunityPost,
  findCommunityPostById,
  getCommunityPostListPage,
  increaseCommunityPostView,
  isCategory,
  listCommunityActivity,
  listCommunityPosts,
  listCommunityReports,
  listPopularCommunityPosts,
  listPopularCommunitySearchQueries,
  logCommunitySearch,
  setCommunityCommentReaction,
  setCommunityReaction,
  updateCommunityComment,
  updateCommunityReport,
  updateCommunityPost,
  type CommunityPostAttachmentInput,
} from "./community.repository";

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 14_000_000;
const MAX_TOTAL_ATTACHMENT_DATA_URL_LENGTH = 14_000_000;
const REPORT_REASON_CODES = [
  "스팸·홍보/도배",
  "욕설·비방·혐오 표현",
  "음란물·부적절한 콘텐츠",
  "개인정보 노출",
  "허위사실·사기",
  "게시판 성격에 맞지 않음",
  "기타",
] as const;

export async function getCommunityPosts(request: NextRequest) {
  const user = await getSessionUser(request);
  const searchParams = request.nextUrl.searchParams;
  const limit = clampNumber(searchParams.get("limit"), 20, 1, 50);
  const offset = clampNumber(searchParams.get("offset"), 0, 0, 10000);
  const searchQuery = (searchParams.get("q") || "").trim();
  const sort = searchParams.get("sort") === "popular" ? "popular" : "latest";
  const category = searchParams.get("category") || undefined;
  const popularPeriod = searchParams.get("popularPeriod") === "today" ? "today" : "week";

  if (searchQuery) {
    await logCommunitySearch(user?.id, searchQuery).catch((error) => {
      console.error("[Community] search log failed", error);
    });
  }

  const [list, popular] = await Promise.all([
    listCommunityPosts({
      category,
      query: searchQuery,
      sort,
      limit,
      offset,
      userId: user?.id,
    }),
    listPopularCommunityPosts(user?.id, popularPeriod),
  ]);

  return {
    ok: true,
    items: list.items,
    popular,
    total: list.total,
    limit,
    offset,
  };
}

export async function getCommunityPost(request: NextRequest, postId: string) {
  const user = await getSessionUser(request);
  if (request.nextUrl.searchParams.get("view") !== "false") {
    await increaseCommunityPostView(postId);
  }
  const post = await findCommunityPostById(postId, user?.id);

  if (!post) {
    const error = new Error("게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return {
    ok: true,
    post,
    boardPage: await getCommunityPostListPage(postId, 20),
  };
}

export async function saveCommunityPost(
  request: NextRequest,
  postId?: string,
) {
  const user = await requireSessionUser(request);
  const body = await readJsonBody(request);
  const input = parsePostInput(body);
  const savedPostId = postId
    ? (await updateCommunityPost(user.id, postId, input) ? postId : null)
    : await createCommunityPost(user.id, input);

  if (!savedPostId) {
    const error = new Error("게시글을 저장할 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  const creditReward = !postId
    ? await grantCommunityActivityMilestoneReward(user.id, {
        type: "post",
        id: savedPostId,
      }).catch((error) => {
        console.error("[Community] post credit reward failed", error);
        return null;
      })
    : null;

  return {
    ok: true,
    post: await findCommunityPostById(savedPostId, user.id),
    creditReward,
  };
}

export async function removeCommunityPost(request: NextRequest, postId: string) {
  const user = await requireSessionUser(request);
  const deleted = await deleteCommunityPost(user.id, postId);

  if (!deleted) {
    const error = new Error("삭제할 게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true };
}

export async function toggleCommunityPostReaction(
  request: NextRequest,
  postId: string,
  reactionType: "recommend" | "scrap",
) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => ({}));
  const enabled = Boolean(body?.enabled);
  const reaction = await setCommunityReaction(user.id, postId, reactionType, enabled);

  if (!reaction) {
    const error = new Error("게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true, reaction };
}

export async function toggleCommunityCommentReaction(
  request: NextRequest,
  commentId: string,
) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => ({}));
  const reactionType = body?.reactionType;

  if (reactionType !== "like" && reactionType !== "dislike") {
    throwBadRequest("댓글 반응 값이 올바르지 않습니다.");
  }

  const reaction = await setCommunityCommentReaction(user.id, commentId, reactionType);

  if (!reaction) {
    const error = new Error("댓글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true, reaction };
}

export async function saveCommunityComment(request: NextRequest, postId: string) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const parentCommentId =
    typeof body?.parentCommentId === "string" && body.parentCommentId.trim()
      ? body.parentCommentId.trim()
      : null;

  if (!content) {
    throwBadRequest("댓글을 입력해주세요.");
  }

  if (content.length > 500) {
    throwBadRequest("댓글은 최대 500자까지 입력할 수 있습니다.");
  }

  if (parentCommentId && !isUuid(parentCommentId)) {
    throwBadRequest("답글 대상이 올바르지 않습니다.");
  }

  const commentId = await createCommunityComment(user.id, postId, content, parentCommentId);
  if (!commentId) {
    const error = new Error(parentCommentId ? "답글을 달 댓글을 찾을 수 없습니다." : "게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  const creditReward = await grantCommunityActivityMilestoneReward(user.id, {
    type: "comment",
    id: commentId,
  }).catch((error) => {
    console.error("[Community] comment credit reward failed", error);
    return null;
  });

  await notifyCommunityComment(commentId, { replyTargetCommentId: parentCommentId }).catch((error) => {
    console.error("[Community] comment notification failed", error);
  });

  return { ok: true, post: await findCommunityPostById(postId, user.id), creditReward };
}

export async function removeCommunityComment(
  request: NextRequest,
  commentId: string,
) {
  const user = await requireSessionUser(request);
  const deletedComment = await deleteCommunityComment(user.id, commentId);

  if (!deletedComment) {
    const error = new Error("삭제할 댓글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return {
    ok: true,
    post: await findCommunityPostById(deletedComment.post_id, user.id),
  };
}

export async function saveCommunityCommentEdit(
  request: NextRequest,
  commentId: string,
) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    throwBadRequest("댓글을 입력해주세요.");
  }

  if (content.length > 500) {
    throwBadRequest("댓글은 최대 500자까지 입력할 수 있습니다.");
  }

  const updatedComment = await updateCommunityComment(user.id, commentId, content);

  if (!updatedComment) {
    const error = new Error("수정할 댓글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return {
    ok: true,
    post: await findCommunityPostById(updatedComment.post_id, user.id),
  };
}

export async function reportCommunityTarget(
  request: NextRequest,
  targetType: "post" | "comment",
  targetId: string,
) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => ({}));
  const reasonCode =
    typeof body?.reasonCode === "string" && REPORT_REASON_CODES.includes(body.reasonCode as (typeof REPORT_REASON_CODES)[number])
      ? body.reasonCode
      : "기타";
  await createCommunityReport(user.id, targetType, targetId, reasonCode);
  return { ok: true };
}

export async function getCommunityActivity(request: NextRequest) {
  const user = await requireSessionUser(request);
  const activity = await listCommunityActivity(user.id);
  return { ok: true, ...activity };
}

export async function getCommunitySearchMeta() {
  return {
    ok: true,
    popularQueries: await listPopularCommunitySearchQueries(),
  };
}

export async function getCommunityReports(request: NextRequest) {
  await requireCommunityModerator(request);
  return {
    ok: true,
    items: await listCommunityReports(request.nextUrl.searchParams.get("status") || undefined),
  };
}

export async function reviewCommunityReport(request: NextRequest, reportId: string) {
  const user = await requireCommunityModerator(request);
  const body = await request.json().catch(() => ({}));
  const status = String(body?.status || "");

  if (!["pending", "reviewing", "resolved", "rejected"].includes(status)) {
    throwBadRequest("신고 검토 상태가 올바르지 않습니다.");
  }

  const report = await updateCommunityReport(user.id, reportId, {
    status: status as "pending" | "reviewing" | "resolved" | "rejected",
    reviewNote: typeof body?.reviewNote === "string" ? body.reviewNote : null,
  });

  if (!report) {
    const error = new Error("신고 내역을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true, report };
}

function parsePostInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throwBadRequest("요청 형식이 올바르지 않습니다. 첨부 이미지 용량을 줄여 다시 시도해 주세요.");
  }

  const body = value as Record<string, unknown>;
  const category = String(body.category || "");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const imageDataUrl =
    typeof body.imageDataUrl === "string" && body.imageDataUrl.trim()
      ? body.imageDataUrl.trim()
      : null;
  const attachments = parseAttachments(body.attachments, imageDataUrl);

  if (!isCategory(category)) {
    throwBadRequest(`카테고리는 ${COMMUNITY_CATEGORIES.join(", ")} 중 하나여야 합니다.`);
  }

  if (!title) {
    throwBadRequest("제목을 입력해주세요.");
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throwBadRequest(`제목은 최대 ${MAX_TITLE_LENGTH}자까지 입력할 수 있습니다.`);
  }

  if (!content) {
    throwBadRequest("내용을 입력해주세요.");
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throwBadRequest(`내용은 최대 ${MAX_CONTENT_LENGTH}자까지 입력할 수 있습니다.`);
  }

  return {
    category: category as CommunityCategory,
    title,
    content,
    imageDataUrl: attachments[0]?.dataUrl || imageDataUrl,
    attachments,
  };
}

function parseAttachments(value: unknown, legacyImageDataUrl: string | null): CommunityPostAttachmentInput[] {
  const rawAttachments = Array.isArray(value) ? value : [];
  const attachments = rawAttachments.map((item) => {
    const row = (item || {}) as Record<string, unknown>;
    return {
      fileName: typeof row.fileName === "string" ? row.fileName.trim().slice(0, 255) : "첨부 이미지",
      mimeType: typeof row.mimeType === "string" ? row.mimeType.trim() : "",
      fileSizeBytes: Number(row.fileSizeBytes || 0),
      dataUrl: typeof row.dataUrl === "string" ? row.dataUrl.trim() : "",
    };
  }).filter((item) => item.dataUrl);

  if (!attachments.length && legacyImageDataUrl) {
    attachments.push({
      fileName: "첨부 이미지",
      mimeType: legacyImageDataUrl.match(/^data:([^;]+);/)?.[1] || "image/png",
      fileSizeBytes: 0,
      dataUrl: legacyImageDataUrl,
    });
  }

  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throwBadRequest(`첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.`);
  }

  for (const attachment of attachments) {
    if (!["image/jpeg", "image/png"].includes(attachment.mimeType)) {
      throwBadRequest("첨부파일은 JPG 또는 PNG만 등록할 수 있습니다.");
    }

    if (!/^data:image\/(png|jpeg);base64,/i.test(attachment.dataUrl)) {
      throwBadRequest("첨부파일 형식이 올바르지 않습니다.");
    }

    if (attachment.fileSizeBytes > 10 * 1024 * 1024 || attachment.dataUrl.length > MAX_ATTACHMENT_DATA_URL_LENGTH) {
      throwBadRequest("첨부파일은 최대 10MB까지 등록할 수 있습니다.");
    }
  }

  const totalDataUrlLength = attachments.reduce((total, attachment) => total + attachment.dataUrl.length, 0);
  if (totalDataUrlLength > MAX_TOTAL_ATTACHMENT_DATA_URL_LENGTH) {
    throwBadRequest("첨부파일 총 용량이 너무 큽니다. 이미지를 줄여 다시 첨부해 주세요.");
  }

  return attachments;
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throwBadRequest("첨부 파일은 최대 10MB까지 등록할 수 있습니다.");
  }
}

async function requireCommunityModerator(request: NextRequest) {
  const user = await requireSessionUser(request);
  const emails = (process.env.COMMUNITY_MODERATOR_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = String(user.email || "").toLowerCase();

  if (!emails.length || !email || !emails.includes(email)) {
    const error = new Error("운영팀 권한이 필요합니다.");
    error.name = "UnauthorizedError";
    throw error;
  }

  return user;
}

function clampNumber(
  value: string | null,
  defaultValue: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function throwBadRequest(message: string): never {
  const error = new Error(message);
  error.name = "BadRequestError";
  throw error;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
