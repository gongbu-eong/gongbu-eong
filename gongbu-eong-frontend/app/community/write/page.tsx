import { CommunityWritePage } from "@/features/community/components/CommunityWritePage";
import { requireCommunityAuth } from "../requireCommunityAuth";

export default async function CommunityWriteRoute() {
  await requireCommunityAuth();
  return <CommunityWritePage />;
}
