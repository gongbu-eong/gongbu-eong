import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { DiagnosisStartEvent } from "@/features/diagnosis/components/DiagnosisAnalyticsEvents";
import { DiagnosisFlow } from "@/features/diagnosis/components/DiagnosisFlow";
import { getDiagnosisShareImageUrl } from "@/features/diagnosis/diagnosis-share";
import { requireEventSession } from "@/shared/event-session";

export const metadata: Metadata = {
  title: "강점·성향 진단 | 공부엉이",
  description: "16문항으로 나의 강점과 취업 성향을 확인해 보세요.",
  alternates: {
    canonical: "/events/diagnosis",
  },
  openGraph: {
    title: "강점·성향 진단 | 공부엉이",
    description: "16문항으로 나의 강점과 취업 성향을 확인해 보세요.",
    url: "/events/diagnosis",
    siteName: "공부엉이",
    type: "website",
    images: [
      {
        url: getDiagnosisShareImageUrl(),
        width: 1200,
        height: 630,
        alt: "공부엉이 강점·성향 진단",
      },
    ],
  },
};

export default async function DiagnosisEventPage() {
  const requestHeaders = await headers();
  if (!isSearchCrawler(requestHeaders.get("user-agent"))) {
    await requireEventSession("1", "/events/diagnosis");
  }

  return (
    <>
      <Suspense fallback={null}>
        <DiagnosisStartEvent />
      </Suspense>
      <DiagnosisFlow />
    </>
  );
}

function isSearchCrawler(userAgent: string | null) {
  return /Googlebot|Bingbot|NaverBot|Yeti|DuckDuckBot|Daumoa|Twitterbot|facebookexternalhit/i.test(
    userAgent || "",
  );
}
