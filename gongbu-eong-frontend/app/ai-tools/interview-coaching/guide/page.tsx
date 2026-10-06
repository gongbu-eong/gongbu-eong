import type { Metadata } from "next";
import { InterviewCoachingGuidePage } from "@/features/interview-coaching/components/InterviewCoachingGuidePage";
import { canonicalUrl } from "@/shared/seo";

export const metadata: Metadata = {
  title: "AI NCS 면접 코칭 사용자 가이드 | 공부엉이",
  description: "공부엉이 AI NCS 면접 코칭의 직무 기반 질문, 꼬리질문, 답변 피드백과 이용 방법을 안내합니다.",
  alternates: { canonical: canonicalUrl("/ai-tools/interview-coaching/guide") },
};

export default async function InterviewCoachingGuideRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  return <InterviewCoachingGuidePage startHref={`/ai-tools/interview-coaching/start${query ? `?${query}` : ""}`} />;
}
