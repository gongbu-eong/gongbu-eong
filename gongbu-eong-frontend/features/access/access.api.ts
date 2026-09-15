import { getAnonymousId } from "@/shared/session/anonymous-id";
import {
  classifyTrafficChannel,
  getAnalyticsSessionId,
  getExternalReferrer,
  getScreenBucket,
} from "@/features/analytics/analytics.api";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export function logPageView(args: {
  path: string;
  title?: string;
  referrer?: string;
  previousPath?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const externalReferrer = args.referrer ?? getExternalReferrer();
  const screen = getScreenBucket(args.path);

  fetch(`${backendUrl}/api/access-logs`, {
    method: "POST",
    keepalive: true,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: getAnonymousId(),
      eventName: "page_view",
      path: args.path,
      title: args.title,
      referrer: externalReferrer || undefined,
      entrySource: resolveEntrySource(args.path),
      sessionId: getAnalyticsSessionId(),
      previousPath: args.previousPath || undefined,
      canonicalPath: screen.canonicalPath,
      screenKey: screen.key,
      trafficChannel: classifyTrafficChannel(
        args.path,
        externalReferrer || null,
        args.previousPath || null,
      ),
      metadata: {
        ...(args.metadata || {}),
        navigation: {
          previousPath: args.previousPath || null,
          externalReferrer: externalReferrer || null,
          canonicalPath: screen.canonicalPath,
          screenKey: screen.key,
          screenName: screen.name,
        },
      },
    }),
  }).catch(() => {
    // Logging must never block page rendering.
  });
}

function resolveEntrySource(path: string) {
  if (path.startsWith("/jobs")) {
    return "jobs";
  }

  if (path.startsWith("/ai-tools/diagnosis")) {
    return "strength_diagnosis";
  }

  if (path.startsWith("/events/diagnosis")) {
    return "strength_diagnosis";
  }

  if (path.startsWith("/ai-tools")) {
    return "ai_tools";
  }

  if (path.startsWith("/calendar")) {
    return "calendar";
  }

  if (path.startsWith("/community")) {
    return "community";
  }

  if (path.startsWith("/my")) {
    return "my_page";
  }

  if (path === "/") {
    return "main_home";
  }

  return "unknown";
}
