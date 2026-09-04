import type { Metadata } from "next";
import { AiToolsPage } from "@/features/ai-tools/components/AiToolsPage";
import { getAiToolEventsForServer } from "@/features/ai-tools/ai-tools.server";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "AI 도구 | 공부엉이",
  description:
    "공기업 취업 도구, 강점·성향 진단, NCS AI 자소서 코칭, 연봉 계산기, 글자수세기, 퇴직금 계산기, 실업급여 계산기를 한 곳에서 확인하세요.",
  alternates: {
    canonical: canonicalUrl("/ai-tools"),
  },
  openGraph: {
    title: "AI 도구 | 공부엉이",
    description:
      "공기업 취업 준비에 필요한 AI 취업 도구, 진단, 자소서 코칭, 취업 계산기를 공부엉이에서 확인하세요.",
    url: canonicalUrl("/ai-tools"),
    siteName: SITE_NAME,
    type: "website",
  },
};

export default async function Page() {
  const events = await getAiToolEventsForServer();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "공부엉이 AI 도구",
    itemListElement: [
      "강점·성향 진단",
      "NCS AI 자소서 코칭",
      "연봉 계산기",
      "글자수세기",
      "퇴직금 계산기",
      "연차/휴가 계산기",
      "실업급여 계산기",
      "학점 계산기",
    ].map((name, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <AiToolsPage initialEvents={events.items} />
    </>
  );
}
