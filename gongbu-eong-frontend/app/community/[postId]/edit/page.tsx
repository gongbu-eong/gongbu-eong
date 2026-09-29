import { CommunityWritePage } from "@/features/community/components/CommunityWritePage";

export default async function CommunityEditRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <CommunityWritePage postId={postId} />;
}
