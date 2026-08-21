import { CommunitySearchPage } from "@/features/community/components/CommunitySearchPage";
import { requireCommunityAuth } from "../requireCommunityAuth";

export default async function CommunitySearchRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireCommunityAuth();
  const params = await searchParams;
  return <CommunitySearchPage initialQuery={params.q} />;
}
