import type { Metadata } from "next";
import { InterviewCoachingPage } from "@/features/interview-coaching/components/InterviewCoachingPage";

export const metadata: Metadata = {
  title: "AI NCS 면접 코칭 이어하기 | 공부엉이",
  description: "저장된 AI NCS 면접 코칭을 이어서 진행하세요.",
  robots: { index: false, follow: false },
};

export default async function MyInterviewCoachingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <InterviewCoachingPage initialSessionId={sessionId} />;
}
