import type { Metadata } from "next";
import { Suspense } from "react";
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
  title: DIAGNOSIS_SHARE_TITLE,
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
  const nextPath = params.resultId
    ? `/events/diagnosis/result?resultId=${encodeURIComponent(params.resultId)}`
    : "/events/diagnosis/result";

  await requireEventSession("1", nextPath);

  return (
    <Suspense fallback={null}>
      <DiagnosisResultDetail />
    </Suspense>
  );
}
