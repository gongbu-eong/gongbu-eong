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
const apiBaseUrl = process.env.NEXT_PUBLIC_EVENT_API_BASE_URL || "";

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
  fetch(`${apiBaseUrl}/api/analytics/attribution`, {
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
  const screen = getScreenBucket(path);

  fetch(`${apiBaseUrl}/api/product-events`, {
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
        client_occurred_at: new Date().toISOString(),
        path,
        title: document.title,
        referrer: document.referrer || null,
        screen_key: screen.key,
        screen_name: screen.name,
        canonical_path: screen.canonicalPath,
        ...(args.properties || {}),
      },
    }),
  }).catch(() => {
    // Product event logging must never block the user flow.
  });
}

export function trackApiRequest(args: {
  path: string;
  method?: string;
  status?: number;
  success: boolean;
}) {
  // API responses are implementation details, not user behavior. The global
  // interaction tracker and semantic product events record the actual action.
  void args;
}

export function getScreenBucket(path: string) {
  const pathname = stripQueryAndHash(path);

  if (pathname === "/") return { key: "home", name: "홈", canonicalPath: "/" };
  if (pathname === "/jobs") return { key: "jobs", name: "공고 목록", canonicalPath: "/jobs" };
  if (/^\/jobs\/[^/]+/.test(pathname)) {
    return { key: "job_detail", name: "공고상세", canonicalPath: "/jobs/[id]" };
  }
  if (pathname.startsWith("/ai-tools/interview-coaching")) {
    return { key: "interview_coaching", name: "AI NCS 면접 코칭", canonicalPath: "/ai-tools/interview-coaching" };
  }
  if (pathname.startsWith("/ai-tools/coaching")) {
    return { key: "coaching", name: "AI NCS 자소서 코칭", canonicalPath: "/ai-tools/coaching" };
  }
  if (pathname.startsWith("/ai-tools/diagnosis") || pathname.startsWith("/events/diagnosis")) {
    return { key: "diagnosis", name: "강약점", canonicalPath: "/diagnosis" };
  }
  if (pathname === "/ai-tools" || pathname.startsWith("/ai-tools/job-tools")) {
    return { key: "ai_tools", name: "AI 도구", canonicalPath: "/ai-tools" };
  }
  if (pathname.startsWith("/community")) return { key: "community", name: "커뮤니티", canonicalPath: "/community" };
  if (pathname.startsWith("/my")) return { key: "my", name: "마이페이지", canonicalPath: "/my" };
  if (pathname.startsWith("/calendar")) return { key: "calendar", name: "캘린더", canonicalPath: "/calendar" };
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return { key: "login", name: "로그인", canonicalPath: "/login" };
  if (pathname.startsWith("/signup")) return { key: "signup", name: "회원가입", canonicalPath: "/signup" };
  if (pathname.startsWith("/notifications")) return { key: "notifications", name: "알림", canonicalPath: "/notifications" };
  if (pathname.startsWith("/study-items")) return { key: "study_items", name: "학습", canonicalPath: "/study-items" };
  if (pathname.startsWith("/s/")) return { key: "share", name: "공유", canonicalPath: "/s/[code]" };
  if (pathname.startsWith("/test")) return { key: "test", name: "테스트", canonicalPath: "/test" };
  if (pathname.startsWith("/health")) return { key: "health", name: "상태 확인", canonicalPath: "/health" };

  return { key: "other", name: "기타", canonicalPath: pathname || "/" };
}

function stripQueryAndHash(path: string) {
  return (path.split("#")[0] || "/").split("?")[0] || "/";
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
