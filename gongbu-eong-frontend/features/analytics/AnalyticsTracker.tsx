"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logPageView } from "@/features/access/access.api";
import { getCurrentUser } from "@/features/home/home.api";
import {
  getStoredAttributionContext,
  saveStoredAttribution,
  syncAttribution,
  type AttributionSnapshot,
} from "./analytics.api";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
const CLICK_ID_KEYS = ["gclid", "fbclid"] as const;

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    getCurrentUser()
      .then((response) => {
        window.gtag?.("set", {
          user_id: response.authenticated ? response.user?.id || null : null,
        });
      })
      .catch(() => {
        // GA user_id is a best-effort analytics hint only.
      });
  }, []);

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    const explicitAttribution = captureAttribution(searchParams, path);
    const current = explicitAttribution || captureCurrentSession(path);
    const { first, last } = getStoredAttributionContext();

    logPageView({
      path,
      title: document.title,
      metadata: {
        attribution: {
          first: summarizeAttribution(first),
          last: summarizeAttribution(last),
          current: summarizeAttribution(current),
        },
      },
    });

    const storedFirst = first || current;
    const storedLast = current || last;

    saveStoredAttribution({
      first: first ? null : current,
      last: current,
      current,
    });

    syncAttribution({
      first: storedFirst,
      last: storedLast,
      current,
    });
  }, [pathname, searchParams]);

  return null;
}

function captureAttribution(
  searchParams: URLSearchParams,
  landingPath: string,
): AttributionSnapshot | null {
  const snapshot: AttributionSnapshot = {};

  UTM_KEYS.forEach((key) => {
    const value = clean(searchParams.get(key), key === "utm_source" || key === "utm_medium");
    if (value) snapshot[key] = value;
  });

  CLICK_ID_KEYS.forEach((key) => {
    const value = clean(searchParams.get(key), false);
    if (value) snapshot[key] = value;
  });

  if (!hasAttributionSignal(snapshot)) {
    return null;
  }

  return {
    ...snapshot,
    landingUrl: window.location.href,
    landingPath,
    referrer: document.referrer || null,
    capturedAt: new Date().toISOString(),
  };
}

function summarizeAttribution(value: AttributionSnapshot | null) {
  if (!value) return null;
  return {
    source: value.utm_source || null,
    medium: value.utm_medium || null,
    campaign: value.utm_campaign || null,
    content: value.utm_content || null,
    term: value.utm_term || null,
    hasGclid: Boolean(value.gclid),
    hasFbclid: Boolean(value.fbclid),
  };
}

function captureCurrentSession(landingPath: string): AttributionSnapshot {
  const referrerHost = toExternalReferrerHost();
  const source = referrerHost || "direct";

  return {
    utm_source: source,
    utm_medium: referrerHost ? "referral" : "direct",
    landingUrl: window.location.href,
    landingPath,
    referrer: document.referrer || null,
    capturedAt: new Date().toISOString(),
  };
}

function hasAttributionSignal(value: AttributionSnapshot | null | undefined) {
  return Boolean(
    value?.utm_source ||
      value?.utm_medium ||
      value?.utm_campaign ||
      value?.utm_content ||
      value?.utm_term ||
      value?.gclid ||
      value?.fbclid,
  );
}

function clean(value: string | null, lowercase: boolean) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return (lowercase ? trimmed.toLowerCase() : trimmed).slice(0, 255);
}

function toExternalReferrerHost() {
  if (!document.referrer) return null;

  try {
    const referrer = new URL(document.referrer);
    if (referrer.origin === window.location.origin) return null;
    return referrer.hostname.toLowerCase().slice(0, 100);
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js" | "set",
      target: string | Date | Record<string, unknown>,
      params?: Record<string, unknown>,
    ) => void;
  }
}
