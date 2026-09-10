import type { Metadata } from "next";
import { InterviewCoachingPage } from "@/features/interview-coaching/components/InterviewCoachingPage";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "AI NCS 면접 코칭 | 공부엉이",
  description: "공기업 채용공고와 지원 직무를 NCS 역량에 연결해 AI NCS 면접 코칭으로 면접 질문, 꼬리질문, 답변 피드백을 연습하세요.",
  keywords: [
    "NCS 면접",
    "AI NCS 면접 코칭",
    "공기업 면접",
    "공공기관 면접",
    "직무 면접 질문",
    "면접 꼬리질문",
    "NCS 직무역량",
  ],
  alternates: {
    canonical: canonicalUrl("/ai-tools/interview-coaching"),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "AI NCS 면접 코칭 | 공부엉이",
    description: "공기업 채용공고와 지원 직무를 NCS 역량에 연결해 AI NCS 면접 코칭으로 면접 질문, 꼬리질문, 답변 피드백을 연습하세요.",
    url: canonicalUrl("/ai-tools/interview-coaching"),
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI NCS 면접 코칭 | 공부엉이",
    description: "공기업 면접 질문과 꼬리질문을 AI NCS 면접 코칭으로 연습하고 답변 피드백을 받아보세요.",
  },
};

export default function InterviewCoachingRoutePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AI NCS 면접 코칭",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description:
      "공기업 채용공고와 지원 직무를 바탕으로 NCS 직무역량을 분석하고 AI NCS 면접 코칭 질문, 꼬리질문, 답변 피드백을 제공하는 면접 코칭 도구입니다.",
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    url: canonicalUrl("/ai-tools/interview-coaching"),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <InterviewCoachingPage />
    </>
  );
}
