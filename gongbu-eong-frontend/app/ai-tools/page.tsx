import type { Metadata } from "next";
import { AiToolsPage } from "@/features/ai-tools/components/AiToolsPage";

export const metadata: Metadata = {
  title: "Ai 도구 | 공부엉이",
  description: "공부엉이의 Ai 취업 도구와 심리 테스트를 확인해 보세요.",
};

export default function Page() {
  return <AiToolsPage />;
}
