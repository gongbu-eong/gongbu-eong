import { JobList } from "@/features/jobs/components/JobList";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ recommended?: string }>;
}) {
  const params = await searchParams;
  return <JobList recommended={params.recommended === "true"} />;
}
