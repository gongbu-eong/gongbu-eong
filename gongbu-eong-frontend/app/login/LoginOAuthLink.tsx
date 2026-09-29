"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getAnonymousId } from "@/shared/session/anonymous-id";

export function LoginOAuthLink({ href, className, children }: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const [anonymousId, setAnonymousId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setAnonymousId(getAnonymousId());
      } catch {
        // Login still works when browser storage is unavailable.
      }
    });
    return () => { active = false; };
  }, []);

  const url = new URL(href);
  if (anonymousId && !url.searchParams.has("anonymousId")) {
    url.searchParams.set("anonymousId", anonymousId);
  }

  return <a className={className} href={url.toString()}>{children}</a>;
}
