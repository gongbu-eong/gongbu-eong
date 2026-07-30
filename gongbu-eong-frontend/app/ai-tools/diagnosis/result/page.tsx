import { Suspense } from "react";
import { DiagnosisResultDetail } from "@/features/diagnosis/components/DiagnosisResultDetail";

export default function DiagnosisResultPage() {
  return (
    <Suspense fallback={null}>
      <DiagnosisResultDetail />
    </Suspense>
  );
}
