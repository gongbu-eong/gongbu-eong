import type { Metadata } from "next";
import { CoachingPage } from "@/features/coaching/components/CoachingPage";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "NCS AI 자소서 코칭 | 공부엉이",
  description:
    "공기업 자소서, NCS 자기소개서, AI 자소서 첨삭, 자소서 문항 분석, 글자 수 기준, 지원 공고 맞춤 피드백까지 한 번에 확인하세요.",
  alternates: {
    canonical: canonicalUrl("/ai-tools/coaching"),
  },
  openGraph: {
    title: "NCS AI 자소서 코칭 | 공부엉이",
    description:
      "공기업 자소서와 NCS 자기소개서를 AI가 분석하고, 문항별 피드백과 개선 예시를 제공합니다.",
    url: canonicalUrl("/ai-tools/coaching"),
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NCS AI 자소서 코칭",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description:
      "공기업 자소서, NCS 자기소개서, AI 자소서 첨삭, 문항별 피드백, 글자 수 기준, 지원 공고 맞춤 분석을 제공하는 AI 취업 도구입니다.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <CoachingPage />
    </>
  );
}
