import { JobList } from "@/features/jobs/components/JobList";
import type { JobListView } from "@/features/home/home.dto";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; resultId?: string }>;
}) {
  const params = await searchParams;
  const view: JobListView =
    params.view === "closing" ||
    params.view === "recommended" ||
    params.view === "bookmarked"
      ? params.view
      : "all";

  return (
    <JobList
      key={`${view}-${params.resultId || "latest"}`}
      view={view}
      resultId={params.resultId}
    />
  );
}
