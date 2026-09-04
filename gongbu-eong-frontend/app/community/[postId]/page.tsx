import type { Metadata } from "next";
import { headers } from "next/headers";
import { CommunityDetailPage } from "@/features/community/components/CommunityDetailPage";
import { getCommunityPostForServer } from "@/features/community/community.server";
import {
  COMMUNITY_SHARE_DESCRIPTION,
  COMMUNITY_SHARE_IMAGE_HEIGHT,
  COMMUNITY_SHARE_IMAGE_WIDTH,
  COMMUNITY_SHARE_TITLE,
  getCommunityPostShareUrl,
  getCommunityShareImageUrl,
} from "@/features/community/community-share";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  const requestOrigin = host ? `${protocol}://${host}` : undefined;
  const url = getCommunityPostShareUrl(postId, requestOrigin);
  const imageUrl = getCommunityShareImageUrl(requestOrigin);
  const response = await getCommunityPostForServer(postId);
  const post = response?.post;
  const title = post?.title ? `${post.title} | 공부엉이` : COMMUNITY_SHARE_TITLE;
  const description = post?.contentPreview || COMMUNITY_SHARE_DESCRIPTION;

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "공부엉이",
      type: "article",
      images: [
        {
          url: imageUrl,
          width: COMMUNITY_SHARE_IMAGE_WIDTH,
          height: COMMUNITY_SHARE_IMAGE_HEIGHT,
          alt: post?.title || COMMUNITY_SHARE_TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function CommunityDetailRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const response = await getCommunityPostForServer(postId, { incrementView: true });
  return <CommunityDetailPage postId={postId} initialPost={response?.post || null} initialBoardPage={response?.boardPage || 1} />;
}
