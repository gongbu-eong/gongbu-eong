import { CommunitySearchPage } from "@/features/community/components/CommunitySearchPage";

export default async function CommunitySearchRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return <CommunitySearchPage initialQuery={params.q} />;
}
