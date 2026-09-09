import type { Metadata } from "next";
import { InterviewCoachingPage } from "@/features/interview-coaching/components/InterviewCoachingPage";
import { canonicalUrl } from "@/shared/seo";

export const metadata: Metadata = {
  title: "NCS 직무 기반 AI 면접 코칭 | 공부엉이",
  description: "지원 직무를 NCS 역량과 연결해 AI 면접 질문과 꼬리질문으로 연습하세요.",
  alternates: {
    canonical: canonicalUrl("/ai-tools/interview-coaching"),
  },
  openGraph: {
    title: "NCS 직무 기반 AI 면접 코칭 | 공부엉이",
    description: "지원 직무를 NCS 역량과 연결해 AI 면접 질문과 꼬리질문으로 연습하세요.",
    url: canonicalUrl("/ai-tools/interview-coaching"),
  },
};

export default function InterviewCoachingRoutePage() {
  return <InterviewCoachingPage />;
}
