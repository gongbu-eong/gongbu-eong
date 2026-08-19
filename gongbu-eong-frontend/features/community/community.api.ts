import { apiClient } from "@/shared/api/client";
import type {
  CommunityActivityResponseDto,
  CommunityAttachmentDto,
  CommunityCategory,
  CommunityCommentReactionResponseDto,
  CommunityDetailResponseDto,
  CommunityListResponseDto,
  CommunityReactionResponseDto,
  CommunitySearchMetaResponseDto,
} from "./community.dto";

export function getCommunityPosts(args?: {
  q?: string;
  category?: string;
  sort?: "latest" | "popular";
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (args?.q) params.set("q", args.q);
  if (args?.category && args.category !== "전체") params.set("category", args.category);
  if (args?.sort) params.set("sort", args.sort);
  if (args?.limit != null) params.set("limit", String(args.limit));
  if (args?.offset != null) params.set("offset", String(args.offset));
  const query = params.size ? `?${params.toString()}` : "";
  return apiClient<CommunityListResponseDto>(`/api/community${query}`);
}

export function getCommunityPost(postId: string) {
  return apiClient<CommunityDetailResponseDto>(`/api/community/${postId}`);
}

export function createCommunityPost(input: {
  category: CommunityCategory;
  title: string;
  content: string;
  imageDataUrl?: string | null;
  attachments?: Pick<CommunityAttachmentDto, "fileName" | "mimeType" | "fileSizeBytes" | "dataUrl">[];
}) {
  return apiClient<CommunityDetailResponseDto>("/api/community", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCommunityPost(postId: string, input: {
  category: CommunityCategory;
  title: string;
  content: string;
  imageDataUrl?: string | null;
  attachments?: Pick<CommunityAttachmentDto, "fileName" | "mimeType" | "fileSizeBytes" | "dataUrl">[];
}) {
  return apiClient<CommunityDetailResponseDto>(`/api/community/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCommunityPost(postId: string) {
  return apiClient<{ ok: true }>(`/api/community/${postId}`, {
    method: "DELETE",
  });
}

export function setCommunityRecommend(postId: string, enabled: boolean) {
  return apiClient<CommunityReactionResponseDto>(`/api/community/${postId}/recommend`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export function setCommunityScrap(postId: string, enabled: boolean) {
  return apiClient<CommunityReactionResponseDto>(`/api/community/${postId}/scrap`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export function reportCommunityPost(postId: string, reasonCode?: string) {
  return apiClient<{ ok: true }>(`/api/community/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reasonCode }),
  });
}

export function createCommunityComment(postId: string, content: string, parentCommentId?: string | null) {
  return apiClient<CommunityDetailResponseDto>(`/api/community/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parentCommentId: parentCommentId || null }),
  });
}

export function deleteCommunityComment(commentId: string) {
  return apiClient<{ ok: true }>(`/api/community/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function reportCommunityComment(commentId: string, reasonCode?: string) {
  return apiClient<{ ok: true }>(`/api/community/comments/${commentId}/report`, {
    method: "POST",
    body: JSON.stringify({ reasonCode }),
  });
}

export function setCommunityCommentReaction(commentId: string, reactionType: "like" | "dislike") {
  return apiClient<CommunityCommentReactionResponseDto>(`/api/community/comments/${commentId}/reaction`, {
    method: "POST",
    body: JSON.stringify({ reactionType }),
  });
}

export function getCommunityActivity() {
  return apiClient<CommunityActivityResponseDto>("/api/community/activity");
}

export function getCommunitySearchMeta() {
  return apiClient<CommunitySearchMetaResponseDto>("/api/community/search-meta");
}
