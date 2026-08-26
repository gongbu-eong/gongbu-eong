import { getAnonymousId } from "@/shared/session/anonymous-id";

export type AttributionSnapshot = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  landingUrl?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
  capturedAt?: string | null;
};

export type AttributionContext = {
  first: AttributionSnapshot | null;
  last: AttributionSnapshot | null;
  current: AttributionSnapshot | null;
};

const FIRST_ATTRIBUTION_KEY = "first_attribution";
const LAST_ATTRIBUTION_KEY = "last_attribution";
const CURRENT_ATTRIBUTION_KEY = "current_attribution";
const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export function getStoredAttributionContext(): AttributionContext {
  return {
    first: readAttribution(FIRST_ATTRIBUTION_KEY),
    last: readAttribution(LAST_ATTRIBUTION_KEY),
    current: readAttribution(CURRENT_ATTRIBUTION_KEY),
  };
}

export function saveStoredAttribution(args: {
  first?: AttributionSnapshot | null;
  last?: AttributionSnapshot | null;
  current?: AttributionSnapshot | null;
}) {
  if (args.first) writeAttribution(FIRST_ATTRIBUTION_KEY, args.first);
  if (args.last) writeAttribution(LAST_ATTRIBUTION_KEY, args.last);
  if (args.current) writeAttribution(CURRENT_ATTRIBUTION_KEY, args.current);
}

export function syncAttribution(args: {
  first?: AttributionSnapshot | null;
  last?: AttributionSnapshot | null;
  current?: AttributionSnapshot | null;
}) {
  fetch(`${backendUrl}/api/analytics/attribution`, {
    method: "POST",
    keepalive: true,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: getAnonymousId(),
      first: args.first || null,
      last: args.last || null,
      current: args.current || null,
    }),
  }).catch(() => {
    // Analytics persistence must never block the user flow.
  });
}

export function trackProductEvent(args: {
  eventType: string;
  diagnosisRunId?: string | null;
  diagnosisResultId?: string | null;
  properties?: Record<string, unknown>;
}) {
  const path = `${window.location.pathname}${window.location.search}`;

  fetch(`${backendUrl}/api/product-events`, {
    method: "POST",
    keepalive: true,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: getAnonymousId(),
      eventType: args.eventType,
      eventSource: "client",
      diagnosisRunId: args.diagnosisRunId || null,
      diagnosisResultId: args.diagnosisResultId || null,
      attribution: getStoredAttributionContext(),
      properties: {
        path,
        title: document.title,
        referrer: document.referrer || null,
        ...(args.properties || {}),
      },
    }),
  }).catch(() => {
    // Product event logging must never block the user flow.
  });
}

function readAttribution(key: string): AttributionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as AttributionSnapshot;
  } catch {
    return null;
  }
}

function writeAttribution(key: string, value: AttributionSnapshot) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
