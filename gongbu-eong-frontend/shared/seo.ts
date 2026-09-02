export const SITE_NAME = "공부엉이";

export function getPublicSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function canonicalUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicSiteOrigin()}${normalizedPath}`;
}
