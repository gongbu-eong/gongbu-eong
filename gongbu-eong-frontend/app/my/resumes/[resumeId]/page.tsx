import { MyResumeView } from "@/features/my/components/MyResumeView";

export default async function Page({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const { resumeId } = await params;
  return <MyResumeView resumeId={resumeId} />;
}
