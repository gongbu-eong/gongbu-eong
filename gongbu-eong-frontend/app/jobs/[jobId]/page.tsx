import { JobDetail } from "@/features/jobs/components/JobDetail";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobDetail jobId={jobId} />;
}
