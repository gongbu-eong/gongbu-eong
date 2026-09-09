import type { Metadata } from "next";
import { InterviewCoachingResultPage } from "@/features/interview-coaching/components/InterviewCoachingResultPage";

export const metadata: Metadata = {
  title: "AI 면접 코칭 결과 | 공부엉이",
  description: "NCS 직무 기반 AI 면접 코칭 결과를 확인하세요.",
  robots: { index: false, follow: false },
};

export default async function InterviewCoachingResultRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ anonymousId?: string }>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  return (
    <InterviewCoachingResultPage
      sessionId={sessionId}
      anonymousId={query.anonymousId || null}
    />
  );
}
