const apiBaseUrl = process.env.NEXT_PUBLIC_EVENT_API_BASE_URL || "";

export async function apiClient<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Backend request failed: ${response.status}`;

    try {
      const body = (await response.json()) as { message?: string };
      message = body.message || message;
    } catch {
      // Keep the fallback HTTP status message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
