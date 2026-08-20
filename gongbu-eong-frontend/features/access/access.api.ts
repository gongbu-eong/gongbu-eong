import { getAnonymousId } from "@/shared/session/anonymous-id";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export function logPageView(args: {
  path: string;
  title?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}) {
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
      referrer: (args.referrer ?? document.referrer) || undefined,
      entrySource: resolveEntrySource(args.path),
      metadata: args.metadata,
    }),
  }).catch(() => {
    // Logging must never block page rendering.
  });
}

function resolveEntrySource(path: string) {
  if (path.startsWith("/ai-tools/diagnosis")) {
    return "diagnosis";
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
