import type { Metadata } from "next";
import { AiJobToolsPage } from "@/features/ai-tools/components/AiJobToolsPage";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "취업 도구 | 공부엉이",
  description:
    "연봉 계산기, 글자수세기, 퇴직금 계산기, 연차/휴가 계산기, 실업급여 계산기, 학점 변환기 등 공기업 취업 준비 계산 도구를 확인하세요.",
  alternates: {
    canonical: canonicalUrl("/ai-tools/job-tools"),
  },
  openGraph: {
    title: "취업 도구 | 공부엉이",
    description:
      "공기업 취업 준비에 필요한 연봉, 퇴직금, 실업급여, 연차, 학점 계산 도구를 공부엉이에서 확인하세요.",
    url: canonicalUrl("/ai-tools/job-tools"),
    siteName: SITE_NAME,
    type: "website",
  },
};

export default async function JobToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const params = await searchParams;
  return <AiJobToolsPage initialTool={params.tool} />;
}
