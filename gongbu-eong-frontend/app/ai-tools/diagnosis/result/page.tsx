import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisShareImageUrl,
} from "@/features/diagnosis/diagnosis-share";
import { buildSignedEventEntryUrl } from "@/shared/events/event-entry";

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

export default async function DiagnosisResultPage({
  searchParams,
}: DiagnosisResultPageProps) {
  const params = await searchParams;
  const nextPath = params.resultId
    ? `/events/diagnosis/result?resultId=${encodeURIComponent(params.resultId)}`
    : "/events/diagnosis/result";

  redirect(await buildSignedEventEntryUrl("1", nextPath));
}
