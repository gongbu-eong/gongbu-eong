import type { MetadataRoute } from "next";

function getEventOrigin() {
  return (
    process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
    process.env.NEXT_PUBLIC_EVENT_APP_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${getEventOrigin()}/events/diagnosis`,
      lastModified: new Date(),
      priority: 0.8,
    },
  ];
}
