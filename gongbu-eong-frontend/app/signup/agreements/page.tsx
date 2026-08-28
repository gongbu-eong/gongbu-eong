import { Suspense } from "react";
import { SignupAgreementsPage } from "@/features/signup/components/SignupAgreementsPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignupAgreementsPage />
    </Suspense>
  );
}
