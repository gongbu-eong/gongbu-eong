import type { Metadata } from "next";
import { InterviewCoachingPage } from "@/features/interview-coaching/components/InterviewCoachingPage";

export const metadata: Metadata = {
  title: "AI NCS 면접 코칭 이어하기 | 공부엉이",
  description: "저장된 AI NCS 면접 코칭을 이어서 진행하세요.",
  robots: { index: false, follow: false },
};

export default async function MyInterviewCoachingSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ anonymousId?: string; view?: string }>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  return (
    <InterviewCoachingPage
      initialSessionId={sessionId}
      initialAnonymousId={query.anonymousId || null}
      allowCompletedView={query.view === "practice"}
    />
  );
}
