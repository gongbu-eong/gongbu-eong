import { cache } from "react";
import type { JobPostingDetailDto } from "@/features/home/home.dto";

const backendUrl =
  process.env.GONGBUEONG_BACKEND_URL ||
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";

export const getJobPostingDetailForServer = cache(
  async (jobId: string, cookieHeader = "") => {
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      return null;
    }

    const headers: HeadersInit = {
      Accept: "application/json",
    };
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(
      `${backendUrl}/api/jobs/${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers,
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Job detail request failed: ${response.status}`);
    }

    return (await response.json()) as JobPostingDetailDto;
  },
);

export function getPublicSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function buildJobSeoDescription(job: JobPostingDetailDto) {
  return compactText(
    [
      job.institutionName,
      job.title,
      job.region ? `근무지 ${job.region}` : "",
      job.employmentType ? `고용형태 ${job.employmentType}` : "",
      job.hiringCount != null ? `채용인원 ${job.hiringCount}명` : "",
      job.qualification,
    ]
      .filter(Boolean)
      .join(". "),
    155,
  );
}

export function buildJobPostingJsonLd(job: JobPostingDetailDto, url: string) {
  return removeUndefined({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: compactText(
      [
        job.basicInfo,
        job.qualification,
        job.preference,
        job.screeningProcess,
        job.applicationMethod,
        job.requiredDocuments,
        job.additionalNotice,
      ]
        .filter(Boolean)
        .join("\n\n"),
      5000,
    ),
    datePosted: job.announcementAt || job.applicationStartAt || undefined,
    validThrough: job.applicationEndAt || undefined,
    employmentType: job.employmentType || undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: job.institutionName,
    },
    jobLocation: job.region
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressRegion: job.region,
            addressCountry: "KR",
          },
        }
      : undefined,
    url,
  });
}

function compactText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefined(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefined(item)]),
    ) as T;
  }

  return value;
}
