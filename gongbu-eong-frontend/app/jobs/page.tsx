import type { Metadata } from "next";
import { JobList } from "@/features/jobs/components/JobList";
import type { JobListView } from "@/features/home/home.dto";
import { getJobPostingsForServer } from "@/features/jobs/jobs.server";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

const JOBS_PAGE_SIZE = 20;

type JobsSearchParams = {
  view?: string;
  resultId?: string;
  scope?: string;
  ncs?: string;
  query?: string;
  category?: string;
  region?: string;
  employmentType?: string;
  education?: string;
  career?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const view = parseView(params.view);
  const isPrivateView = view === "recommended" || view === "bookmarked";
  const title =
    view === "closing"
      ? "마감 임박 채용공고 | 공부엉이"
      : view === "recommended"
        ? "진단결과 추천공고 | 공부엉이"
        : view === "bookmarked"
          ? "찜한공고 | 공부엉이"
          : "채용공고 | 공부엉이";
  const description =
    "공기업 채용공고, 접수 기간, 근무지, 고용형태, 채용인원, 지원 자격을 공부엉이에서 확인해 보세요.";

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl("/jobs"),
    },
    robots: isPrivateView
      ? {
          index: false,
          follow: false,
        }
      : undefined,
    openGraph: {
      title,
      description,
      url: canonicalUrl("/jobs"),
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsSearchParams>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const sort = parseSort(params.sort);
  const initialNcs = splitParam(params.ncs);
  const scope =
    params.scope === "monthly-regular" ? "monthly-regular" : undefined;
  const shouldRenderInitialJobs =
    view === "all" || view === "closing";
  const initialResponse = shouldRenderInitialJobs
    ? await getJobPostingsForServer({
        view,
        query: params.query,
        category: params.category,
        ncs: initialNcs.join("|") || undefined,
        region: params.region,
        employmentType: params.employmentType,
        education: params.education,
        career: params.career,
        startDate: params.startDate,
        endDate: params.endDate,
        sort,
        scope,
        limit: JOBS_PAGE_SIZE,
        offset: 0,
      })
    : null;
  const jsonLd = initialResponse
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "공부엉이 채용공고",
        itemListElement: initialResponse.items.map((job, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: canonicalUrl(`/jobs/${job.id}`),
          name: `${job.institutionName} ${job.title}`,
        })),
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <JobList
        key={`${view}-${params.resultId || "latest"}-${params.scope || "all"}-${params.ncs || "all-ncs"}-${params.query || "empty"}-${sort}`}
        view={view}
        resultId={params.resultId}
        scope={scope}
        initialNcs={initialNcs}
        initialQuery={params.query || ""}
        initialSort={sort}
        initialJobs={initialResponse?.items || []}
        initialTotal={initialResponse?.total || 0}
        initialRecommendationTypeName={
          initialResponse?.recommendationTypeName || null
        }
        hasInitialJobs={Boolean(initialResponse)}
      />
    </>
  );
}

function parseView(value?: string): JobListView {
  return value === "closing" ||
    value === "recommended" ||
    value === "bookmarked"
    ? value
    : "all";
}

function parseSort(value?: string) {
  return value === "latest" || value === "views" ? value : "closing";
}

function splitParam(value?: string) {
  return (value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}
