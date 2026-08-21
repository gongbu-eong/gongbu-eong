import { Suspense } from "react";
import { CommunityActivityPage } from "@/features/community/components/CommunityActivityPage";
import { requireCommunityAuth } from "../requireCommunityAuth";

export default async function CommunityActivityRoute() {
  await requireCommunityAuth();
  return (
    <Suspense fallback={null}>
      <CommunityActivityPage />
    </Suspense>
  );
}
