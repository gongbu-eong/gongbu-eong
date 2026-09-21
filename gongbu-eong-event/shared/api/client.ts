import { trackApiRequest } from "@/features/analytics/analytics.api";

const apiBaseUrl = process.env.NEXT_PUBLIC_EVENT_API_BASE_URL || "";

export async function apiClient<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => null) as { message?: string } | T | null;
  trackApiRequest({ path, method, status: response.status, success: response.ok });

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && body.message
        ? body.message
        : `Backend request failed: ${response.status}`;
    throw new Error(message);
  }

  if (body === null) {
    throw new Error("Backend response was empty.");
  }

  return body as T;
}
