"use client";

import { getAnonymousId } from "@/shared/session/anonymous-id";

export function makeLoginHref(returnTo?: string | null) {
  const params = new URLSearchParams();
  const nextPath = returnTo || getCurrentPath();

  if (nextPath && isInternalPath(nextPath)) {
    params.set("returnTo", nextPath);
  }

  if (typeof window !== "undefined") {
    const anonymousId = getAnonymousId();
    if (anonymousId) {
      params.set("anonymousId", anonymousId);
    }
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

function getCurrentPath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

function isInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}
