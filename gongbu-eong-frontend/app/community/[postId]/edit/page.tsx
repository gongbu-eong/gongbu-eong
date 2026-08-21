import { CommunityWritePage } from "@/features/community/components/CommunityWritePage";
import { requireCommunityAuth } from "../../requireCommunityAuth";

export default async function CommunityEditRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  await requireCommunityAuth();
  const { postId } = await params;
  return <CommunityWritePage postId={postId} />;
}
