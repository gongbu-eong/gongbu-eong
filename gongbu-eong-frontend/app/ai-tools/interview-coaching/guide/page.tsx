import type { Metadata } from "next";
import { InterviewCoachingGuidePage } from "@/features/interview-coaching/components/InterviewCoachingGuidePage";

export const metadata: Metadata = {
  title: "AI NCS 면접 코칭 사용자 가이드 | 공부엉이",
  description: "공부엉이 AI NCS 면접 코칭의 결과 화면과 이용 방법을 안내합니다.",
};

export default function InterviewCoachingGuideRoute() {
  return <InterviewCoachingGuidePage />;
}
