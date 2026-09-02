import type { MetadataRoute } from "next";
import { getPublicSiteOrigin } from "@/shared/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/jobs",
        "/jobs/",
        "/ai-tools",
        "/ai-tools/diagnosis",
        "/ai-tools/coaching",
        "/ai-tools/job-tools",
        "/calendar",
        "/community",
        "/events/diagnosis",
      ],
      disallow: [
        "/api/",
        "/events/diagnosis/result",
        "/my/",
        "/notifications",
        "/signup/",
        "/community/write",
        "/community/activity",
        "/community/search",
        "/community/*/edit",
        "/test",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
