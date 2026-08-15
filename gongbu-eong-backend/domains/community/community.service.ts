import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import {
  grantCommunityCommentMilestoneReward,
  grantCommunityPostCreateReward,
} from "@/domains/credits/credits.repository";
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
  increaseCommunityPostView,
  isCategory,
  listCommunityActivity,
  listCommunityPosts,
  listCommunityReports,
  listPopularCommunityPosts,
  listPopularCommunitySearchQueries,
  logCommunitySearch,
  setCommunityReaction,
  updateCommunityReport,
  updateCommunityPost,
  type CommunityPostAttachmentInput,
} from "./community.repository";

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const MAX_ATTACHMENT_COUNT = 20;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 14_000_000;
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

  if (searchQuery) {
    void logCommunitySearch(user?.id, searchQuery).catch((error) => {
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
    listPopularCommunityPosts(user?.id),
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
  await increaseCommunityPostView(postId);
  const post = await findCommunityPostById(postId, user?.id);

  if (!post) {
    const error = new Error("게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true, post };
}

export async function saveCommunityPost(
  request: NextRequest,
  postId?: string,
) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => null);
  const input = parsePostInput(body);
  const savedPostId = postId
    ? (await updateCommunityPost(user.id, postId, input) ? postId : null)
    : await createCommunityPost(user.id, input);

  if (!savedPostId) {
    const error = new Error("게시글을 저장할 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  if (!postId) {
    await grantCommunityPostCreateReward(user.id, savedPostId).catch((error) => {
      console.error("[Community] post credit reward failed", error);
    });
  }

  return { ok: true, post: await findCommunityPostById(savedPostId, user.id) };
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
  const post = await setCommunityReaction(user.id, postId, reactionType, enabled);

  if (!post) {
    const error = new Error("게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true, post };
}

export async function saveCommunityComment(request: NextRequest, postId: string) {
  const user = await requireSessionUser(request);
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    throwBadRequest("댓글을 입력해주세요.");
  }

  if (content.length > 500) {
    throwBadRequest("댓글은 최대 500자까지 입력할 수 있습니다.");
  }

  const commentId = await createCommunityComment(user.id, postId, content);
  if (!commentId) {
    const error = new Error("게시글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  await grantCommunityCommentMilestoneReward(user.id, commentId).catch((error) => {
    console.error("[Community] comment credit reward failed", error);
  });

  return { ok: true, post: await findCommunityPostById(postId, user.id) };
}

export async function removeCommunityComment(
  request: NextRequest,
  commentId: string,
) {
  const user = await requireSessionUser(request);
  const deleted = await deleteCommunityComment(user.id, commentId);

  if (!deleted) {
    const error = new Error("삭제할 댓글을 찾을 수 없습니다.");
    error.name = "NotFoundError";
    throw error;
  }

  return { ok: true };
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
  const body = (value || {}) as Record<string, unknown>;
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

  return attachments;
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
