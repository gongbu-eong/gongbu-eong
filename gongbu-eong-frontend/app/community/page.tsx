import type { Metadata } from "next";
import { CommunityMain } from "@/features/community/components/CommunityMain";
import { getCommunityPostsForServer } from "@/features/community/community.server";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "커뮤니티 | 공부엉이",
  description:
    "공기업 취준생들의 자유글, 공시 정보, 공부·스터디, 질문·답변, 합격·면접 후기를 확인해 보세요.",
  alternates: {
    canonical: canonicalUrl("/community"),
  },
  openGraph: {
    title: "커뮤니티 | 공부엉이",
    description:
      "공기업 취준생들이 나누는 정보와 질문, 합격·면접 후기 커뮤니티입니다.",
    url: canonicalUrl("/community"),
    siteName: SITE_NAME,
    type: "website",
  },
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page || 1);
  const currentPage = Number.isFinite(page) ? Math.max(1, page) : 1;
  const response = await getCommunityPostsForServer({
    category: params.category,
    q: params.q,
    sort: params.sort === "popular" ? "popular" : "latest",
    popularPeriod: "week",
    limit: 20,
    offset: (currentPage - 1) * 20,
  });

  return (
    <CommunityMain
      key={`${params.category || "all"}-${params.q || "empty"}-${params.sort || "latest"}-${currentPage}`}
      initialCategory={params.category}
      initialQuery={params.q}
      initialSort={params.sort === "popular" ? "popular" : "latest"}
      initialPage={currentPage}
      initialItems={response.items}
      initialPopular={response.popular}
      initialTotal={response.total}
    />
  );
}
