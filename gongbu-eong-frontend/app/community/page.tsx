import { CommunityMain } from "@/features/community/components/CommunityMain";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const params = await searchParams;

  return (
    <CommunityMain
      key={`${params.category || "all"}-${params.q || "empty"}-${params.sort || "latest"}`}
      initialCategory={params.category}
      initialQuery={params.q}
      initialSort={params.sort === "popular" ? "popular" : "latest"}
    />
  );
}
