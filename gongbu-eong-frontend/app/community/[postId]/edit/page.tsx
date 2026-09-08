import { CommunityWritePage } from "@/features/community/components/CommunityWritePage";
import { requireCommunityAuth } from "../../requireCommunityAuth";

export default async function CommunityEditRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  await requireCommunityAuth(`/community/${postId}/edit`);
  return <CommunityWritePage postId={postId} />;
}
