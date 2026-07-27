import { getAnonymousId } from "@/shared/session/anonymous-id";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export function logPageView(args: { path: string; title?: string }) {
  if (!backendUrl) {
    return;
  }

  fetch(`${backendUrl}/api/access-logs`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: getAnonymousId(),
      eventName: "page_view",
      path: args.path,
      title: args.title,
      referrer: document.referrer || undefined,
      entrySource: resolveEntrySource(args.path),
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
