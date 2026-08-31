import { Suspense } from "react";
import { AiJobToolsPage } from "@/features/ai-tools/components/AiJobToolsPage";

export default function JobToolsPage() {
  return (
    <Suspense fallback={null}>
      <AiJobToolsPage />
    </Suspense>
  );
}
