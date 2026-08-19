import { Suspense } from "react";
import { CommunityActivityPage } from "@/features/community/components/CommunityActivityPage";

export default function CommunityActivityRoute() {
  return (
    <Suspense fallback={null}>
      <CommunityActivityPage />
    </Suspense>
  );
}
