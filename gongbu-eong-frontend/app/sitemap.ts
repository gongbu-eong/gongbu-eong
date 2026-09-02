import type { MetadataRoute } from "next";
import type { JobPostingListResponseDto } from "@/features/home/home.dto";
import { fetchBackendJson } from "@/shared/server-data";
import { canonicalUrl } from "@/shared/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalUrl("/"), lastModified: now, priority: 1 },
    { url: canonicalUrl("/jobs"), lastModified: now, priority: 0.9 },
    { url: canonicalUrl("/ai-tools"), lastModified: now, priority: 0.8 },
    {
      url: canonicalUrl("/ai-tools/diagnosis"),
      lastModified: now,
      priority: 0.8,
    },
    {
      url: canonicalUrl("/ai-tools/coaching"),
      lastModified: now,
      priority: 0.75,
    },
    {
      url: canonicalUrl("/ai-tools/job-tools"),
      lastModified: now,
      priority: 0.75,
    },
    { url: canonicalUrl("/calendar"), lastModified: now, priority: 0.7 },
    { url: canonicalUrl("/community"), lastModified: now, priority: 0.65 },
  ];

  const jobs = await fetchBackendJson<JobPostingListResponseDto>(
    "/api/jobs?limit=200&sort=latest",
  ).catch(() => null);

  const jobRoutes: MetadataRoute.Sitemap =
    jobs?.items.map((job) => ({
      url: canonicalUrl(`/jobs/${job.id}`),
      lastModified: job.applicationEndAt ? new Date(job.applicationEndAt) : now,
      priority: 0.8,
    })) ?? [];

  return [...staticRoutes, ...jobRoutes];
}
