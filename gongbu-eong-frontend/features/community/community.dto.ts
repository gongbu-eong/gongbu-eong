export const COMMUNITY_CATEGORIES = [
  "자유·잡담",
  "공시 정보",
  "공부·스터디",
  "질문·답변",
  "합격·면접 후기",
  "유머·짤",
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export type CommunityAuthorDto = {
  id: string;
  nickname: string;
  statusMessage: string | null;
  avatarKey: string;
  backgroundColor: string;
  diagnosisTypeName: string | null;
};

export type CommunityAttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  dataUrl: string;
};

export type CommunityPostSummaryDto = {
  id: string;
  category: CommunityCategory;
  title: string;
  contentPreview: string;
  imageUrl: string | null;
  attachments: CommunityAttachmentDto[];
  author: CommunityAuthorDto;
  viewCount: number;
  recommendCount: number;
  commentCount: number;
  scrapCount: number;
  isRecommended: boolean;
  isScrapped: boolean;
  isBest: boolean;
  createdAt: string;
};

export type CommunityCommentDto = {
  id: string;
  postId: string;
  postTitle?: string | null;
  parentCommentId: string | null;
  status: "active" | "deleted";
  content: string;
  author: CommunityAuthorDto;
  createdAt: string;
  canDelete: boolean;
  likeCount: number;
  dislikeCount: number;
  myReaction: "like" | "dislike" | null;
  replies: CommunityCommentDto[];
};

export type CommunityPostDetailDto = CommunityPostSummaryDto & {
  content: string;
  comments: CommunityCommentDto[];
  canEdit: boolean;
};

export type CommunityListResponseDto = {
  ok: true;
  items: CommunityPostSummaryDto[];
  popular: CommunityPostSummaryDto[];
  total: number;
  limit: number;
  offset: number;
};

export type CommunityDetailResponseDto = {
  ok: true;
  post: CommunityPostDetailDto;
  boardPage?: number;
  creditReward?: {
    granted: boolean;
    balanceAfter: number;
    progress?: {
      activityCount: number;
      milestoneCount: number;
      currentCount: number;
      remainingCount: number;
      percent: number;
      isMaxed: boolean;
    };
  } | null;
};

export type CommunityReactionResponseDto = {
  ok: true;
  reaction: {
    recommendCount: number;
    scrapCount: number;
    isRecommended: boolean;
    isScrapped: boolean;
    isBest: boolean;
  };
};

export type CommunityCommentReactionResponseDto = {
  ok: true;
  reaction: {
    commentId: string;
    likeCount: number;
    dislikeCount: number;
    myReaction: "like" | "dislike" | null;
  };
};

export type CommunityActivityResponseDto = {
  ok: true;
  posts: CommunityPostSummaryDto[];
  comments: CommunityCommentDto[];
  scraps: CommunityPostSummaryDto[];
};

export type CommunitySearchMetaResponseDto = {
  ok: true;
  popularQueries: string[];
};
