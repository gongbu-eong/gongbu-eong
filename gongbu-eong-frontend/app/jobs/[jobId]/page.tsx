import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { JobDetail } from "@/features/jobs/components/JobDetail";
import {
  buildJobPostingJsonLd,
  buildJobSeoDescription,
  getJobPostingDetailForServer,
  getPublicSiteOrigin,
} from "@/features/jobs/job-detail.server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobId: string }>;
}): Promise<Metadata> {
  const { jobId } = await params;
  const cookieHeader = (await cookies()).toString();
  const job = await getJobPostingDetailForServer(jobId, cookieHeader).catch(
    () => null,
  );

  if (!job) {
    return {
      title: "공고정보 | 공부엉이",
      description:
        "공기업 채용공고, 공공기관 채용 정보, 접수 기간, 지원 자격, 채용인원, 전형 절차를 공부엉이에서 확인하세요.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const origin = getPublicSiteOrigin();
  const canonicalUrl = `${origin}/jobs/${job.id}`;
  const title = `${job.institutionName} ${job.title} | 공부엉이`;
  const description = buildJobSeoDescription(job);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "공부엉이",
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const cookieHeader = (await cookies()).toString();
  const job = await getJobPostingDetailForServer(jobId, cookieHeader);

  if (!job) {
    notFound();
  }

  const canonicalUrl = `${getPublicSiteOrigin()}/jobs/${job.id}`;
  const jsonLd = buildJobPostingJsonLd(job, canonicalUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <JobDetail jobId={jobId} initialJob={job} />
    </>
  );
}
