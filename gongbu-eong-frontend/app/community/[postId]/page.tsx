import type { Metadata } from "next";
import { headers } from "next/headers";
import { CommunityDetailPage } from "@/features/community/components/CommunityDetailPage";
import {
  COMMUNITY_SHARE_DESCRIPTION,
  COMMUNITY_SHARE_IMAGE_HEIGHT,
  COMMUNITY_SHARE_IMAGE_WIDTH,
  COMMUNITY_SHARE_TITLE,
  getCommunityPostShareUrl,
  getCommunityShareImageUrl,
} from "@/features/community/community-share";
import { requireCommunityAuth } from "../requireCommunityAuth";

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

  return {
    title: COMMUNITY_SHARE_TITLE,
    description: COMMUNITY_SHARE_DESCRIPTION,
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title: COMMUNITY_SHARE_TITLE,
      description: COMMUNITY_SHARE_DESCRIPTION,
      url,
      siteName: "공부엉이",
      type: "article",
      images: [
        {
          url: imageUrl,
          width: COMMUNITY_SHARE_IMAGE_WIDTH,
          height: COMMUNITY_SHARE_IMAGE_HEIGHT,
          alt: COMMUNITY_SHARE_TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: COMMUNITY_SHARE_TITLE,
      description: COMMUNITY_SHARE_DESCRIPTION,
      images: [imageUrl],
    },
  };
}

export default async function CommunityDetailRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  await requireCommunityAuth();
  const { postId } = await params;
  return <CommunityDetailPage postId={postId} />;
}
