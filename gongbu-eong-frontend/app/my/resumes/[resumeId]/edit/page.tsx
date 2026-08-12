import { MyResumeForm } from "@/features/my/components/MyResumeForm";

export default async function Page({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const { resumeId } = await params;
  return <MyResumeForm mode="edit" resumeId={resumeId} />;
}
