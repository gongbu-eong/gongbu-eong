"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { logPageView } from "@/features/access/access.api";
import { getCurrentUser } from "@/features/home/home.api";
import {
  getScreenBucket,
  getStoredAttributionContext,
  saveStoredAttribution,
  syncAttribution,
  trackProductEvent,
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
    const screen = getScreenBucket(path);

    logPageView({
      path,
      title: document.title,
      metadata: {
        attribution: {
          first: summarizeAttribution(first),
          last: summarizeAttribution(last),
          current: summarizeAttribution(current),
        },
        screen,
      },
    });

    const storedFirst = first || current;
    const storedLast = current || last;

    saveStoredAttribution({
      first: first ? null : current,
      last: current,
      current,
    });

    if (shouldSyncAttribution(current)) {
      syncAttribution({
        first: storedFirst,
        last: storedLast,
        current,
      });
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickable = target.closest(
        "a,button,input,select,textarea,label,[role='button'],[data-track-click]",
      );
      if (!clickable) return;

      const screen = getScreenBucket(window.location.pathname);
      trackProductEvent({
        eventType: "screen_click",
        properties: {
          screen_key: screen.key,
          screen_name: screen.name,
          element_tag: clickable.tagName.toLowerCase(),
          element_text: getElementText(clickable),
          href:
            clickable instanceof HTMLAnchorElement
              ? clickable.getAttribute("href")
              : null,
        },
      });
    };

    const handleChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
        return;
      }

      const screen = getScreenBucket(window.location.pathname);
      trackProductEvent({
        eventType: "screen_change",
        properties: {
          screen_key: screen.key,
          screen_name: screen.name,
          element_tag: target.tagName.toLowerCase(),
          element_type: target instanceof HTMLInputElement ? target.type : null,
          element_name: target.getAttribute("name"),
          element_id: target.id || null,
          has_value: target instanceof HTMLInputElement &&
            (target.type === "checkbox" || target.type === "radio")
            ? target.checked
            : Boolean(target.value),
          file_count: target instanceof HTMLInputElement && target.type === "file"
            ? target.files?.length || 0
            : null,
        },
      });
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const screen = getScreenBucket(window.location.pathname);
      trackProductEvent({
        eventType: "screen_submit",
        properties: {
          screen_key: screen.key,
          screen_name: screen.name,
          form_id: form.id || null,
          form_name: form.getAttribute("name"),
          action: form.getAttribute("action"),
        },
      });
    };

    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("change", handleChange, { capture: true });
    document.addEventListener("submit", handleSubmit, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}

function shouldSyncAttribution(current: AttributionSnapshot | null) {
  const signature = JSON.stringify(current && {
    source: current.utm_source || null,
    medium: current.utm_medium || null,
    campaign: current.utm_campaign || null,
    content: current.utm_content || null,
    term: current.utm_term || null,
    gclid: current.gclid || null,
    fbclid: current.fbclid || null,
    referrer: current.referrer || null,
  });
  const key = "gongbu-eong-last-attribution-sync";
  if (window.sessionStorage.getItem(key) === signature) return false;
  window.sessionStorage.setItem(key, signature);
  return true;
}

function getElementText(element: Element) {
  const label =
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent;

  return label?.replace(/\s+/g, " ").trim().slice(0, 120) || null;
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
