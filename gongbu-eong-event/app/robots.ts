import type { MetadataRoute } from "next";

function getEventOrigin() {
  return (
    process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
    process.env.NEXT_PUBLIC_EVENT_APP_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const origin = getEventOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: ["/events/diagnosis"],
      disallow: ["/api/", "/events/diagnosis/result"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
