import { JobList } from "@/features/jobs/components/JobList";
import type { JobListView } from "@/features/home/home.dto";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; resultId?: string; scope?: string; ncs?: string }>;
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
      key={`${view}-${params.resultId || "latest"}-${params.scope || "all"}-${params.ncs || "all-ncs"}`}
      view={view}
      resultId={params.resultId}
      scope={params.scope === "monthly-regular" ? "monthly-regular" : undefined}
      initialNcs={splitParam(params.ncs)}
    />
  );
}

function splitParam(value?: string) {
  return (value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}
