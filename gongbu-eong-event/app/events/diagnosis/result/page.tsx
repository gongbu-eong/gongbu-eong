import type { Metadata } from "next";
import { Suspense } from "react";
import { DiagnosisResultViewEvent } from "@/features/diagnosis/components/DiagnosisAnalyticsEvents";
import { DiagnosisResultDetail } from "@/features/diagnosis/components/DiagnosisResultDetail";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisShareImageUrl,
} from "@/features/diagnosis/diagnosis-share";
import { requireEventSession } from "@/shared/event-session";

type DiagnosisResultPageProps = {
  searchParams: Promise<{
    resultId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "강점·성향 진단 결과 | 공부엉이",
  description: DIAGNOSIS_SHARE_DESCRIPTION,
  openGraph: {
    title: DIAGNOSIS_SHARE_TITLE,
    description: DIAGNOSIS_SHARE_DESCRIPTION,
    images: [
      {
        url: getDiagnosisShareImageUrl(),
        width: 1200,
        height: 630,
        alt: "공부엉이 강점·성향 진단 결과",
      },
    ],
  },
};

export default async function DiagnosisEventResultPage({
  searchParams,
}: DiagnosisResultPageProps) {
  const params = await searchParams;
  const nextParams = new URLSearchParams();
  if (params.resultId) nextParams.set("resultId", params.resultId);
  const nextQuery = nextParams.toString();
  const nextPath = `/events/diagnosis/result${nextQuery ? `?${nextQuery}` : ""}`;

  await requireEventSession("1", nextPath);

  return (
    <Suspense fallback={null}>
      <DiagnosisResultViewEvent />
      <DiagnosisResultDetail />
    </Suspense>
  );
}
