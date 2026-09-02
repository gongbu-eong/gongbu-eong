import type { Metadata } from "next";
import { CoachingPage } from "@/features/coaching/components/CoachingPage";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "NCS AI 자소서 코칭 | 공부엉이",
  description:
    "자기소개서 문항, 글자 수, 지원 공고, 강점·성향 진단 결과를 바탕으로 AI가 NCS 자소서 코칭을 제공합니다.",
  alternates: {
    canonical: canonicalUrl("/ai-tools/coaching"),
  },
  openGraph: {
    title: "NCS AI 자소서 코칭 | 공부엉이",
    description:
      "총평, 문항별 피드백, 개선 예시까지 한 번에 확인하는 공부엉이 AI 자소서 코칭입니다.",
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
      "자기소개서 문항과 글자 수, 지원 공고를 입력하면 NCS 기준으로 자소서 피드백을 제공하는 AI 취업 도구입니다.",
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
