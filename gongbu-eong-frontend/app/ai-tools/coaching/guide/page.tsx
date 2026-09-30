import type { Metadata } from "next";
import { CoachingGuidePage } from "@/features/coaching/components/CoachingGuidePage";
import { canonicalUrl } from "@/shared/seo";

export const metadata: Metadata = {
  title: "AI NCS 자소서 코칭 사용자 가이드 | 공부엉이",
  description: "공부엉이 AI NCS 자소서 코칭의 결과 화면과 이용 방법을 안내합니다.",
  alternates: {
    canonical: canonicalUrl("/ai-tools/coaching/guide"),
  },
};

export default async function CoachingGuideRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const query = params.toString();

  return (
    <CoachingGuidePage
      startHref={`/ai-tools/coaching/start${query ? `?${query}` : ""}`}
    />
  );
}
