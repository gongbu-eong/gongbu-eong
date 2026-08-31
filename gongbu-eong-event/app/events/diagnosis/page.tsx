import type { Metadata } from "next";
import { DiagnosisFlow } from "@/features/diagnosis/components/DiagnosisFlow";
import { getDiagnosisShareImageUrl } from "@/features/diagnosis/diagnosis-share";
import { requireEventSession } from "@/shared/event-session";

export const metadata: Metadata = {
  title: "강점·성향 진단 | 공부엉이",
  description: "20문항으로 나의 강점과 취업 성향을 확인해 보세요.",
  openGraph: {
    title: "강점·성향 진단 | 공부엉이",
    description: "20문항으로 나의 강점과 취업 성향을 확인해 보세요.",
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
  await requireEventSession("1", "/events/diagnosis");

  return <DiagnosisFlow />;
}
