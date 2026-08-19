import { CommunityMain } from "@/features/community/components/CommunityMain";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page || 1);

  return (
    <CommunityMain
      key={`${params.category || "all"}-${params.q || "empty"}-${params.sort || "latest"}-${Number.isFinite(page) ? page : 1}`}
      initialCategory={params.category}
      initialQuery={params.q}
      initialSort={params.sort === "popular" ? "popular" : "latest"}
      initialPage={Number.isFinite(page) ? page : 1}
    />
  );
}
