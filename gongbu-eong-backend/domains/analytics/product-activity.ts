import { randomUUID } from "node:crypto";
import { recordProductEvent } from "./analytics.repository";

type ActivityOptions = {
  request: Request;
  userId?: string | null;
  anonymousId?: string | null;
  screen: "resume_coaching" | "interview_coaching";
  startEvent: string;
  completeEvent: string;
  failureEvent: string;
  properties?: Record<string, unknown>;
};

// Persist the attempt before the long-running AI call, independently of the browser.
export async function beginProductActivity(options: ActivityOptions) {
  const startedAt = Date.now();
  const actionId = randomUUID();
  const isResume = options.screen === "resume_coaching";
  const path = isResume ? "/ai-tools/coaching" : "/ai-tools/interview-coaching";
  const screenName = isResume ? "AI NCS 자소서 코칭" : "AI NCS 면접 코칭";
  const write = async (eventType: string, properties: Record<string, unknown> = {}) => {
    try {
      await recordProductEvent({
        userId: options.userId || undefined,
        ipAddress: options.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          || options.request.headers.get("x-real-ip") || undefined,
        userAgent: options.request.headers.get("user-agent") || undefined,
        body: {
          eventType,
          eventSource: "server",
          anonymousId: options.anonymousId || null,
          properties: {
            ...options.properties,
            ...properties,
            action_id: actionId,
            path,
            canonical_path: path,
            screen_key: options.screen,
            screen_name: screenName,
            title: screenName,
          },
        },
      });
    } catch {
      // A logging outage must not fail coaching or expose submitted content in errors.
      console.error("[ProductActivity] event persistence failed", { eventType, actionId });
    }
  };
  await write(options.startEvent);
  return {
    complete: (properties: Record<string, unknown> = {}) => write(options.completeEvent, {
      ...properties, duration_ms: Date.now() - startedAt,
    }),
    fail: () => write(options.failureEvent, { duration_ms: Date.now() - startedAt }),
  };
}
