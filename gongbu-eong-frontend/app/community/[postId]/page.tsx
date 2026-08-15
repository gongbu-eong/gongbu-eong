import { CommunityDetailPage } from "@/features/community/components/CommunityDetailPage";

export default async function CommunityDetailRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <CommunityDetailPage postId={postId} />;
}
