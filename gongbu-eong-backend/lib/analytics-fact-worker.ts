/**
 * The queue is durable in PostgreSQL. This request is only a wake-up signal;
 * a failed request never loses work because the queue row remains pending.
 */
export async function wakeAnalyticsFactWorker() {
  const baseUrl = process.env.ADMIN_ANALYTICS_FACT_WORKER_URL?.replace(/\/$/, "");
  const key = process.env.ANALYTICS_FACT_WORKER_KEY;

  if (!baseUrl || !key) return;

  try {
    // Raw-event triggers coalesce a short burst before the day is eligible.
    await new Promise<void>((resolve) => setTimeout(resolve, 3_500));
    // Separate requests keep multi-scope refreshes below proxy timeouts.
    // Stop on failure: the timed-out request may still be running server-side.
    const startedAt = Date.now();
    for (let index = 0; index < 5; index += 1) {
      if (Date.now() - startedAt >= 20_000) break;
      const response = await fetch(`${baseUrl}/api/internal/analytics/facts/process?limit=1`, {
        method: "POST",
        headers: { "x-analytics-fact-worker-key": key },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) break;
      const result = await response.json() as { ok?: boolean; processed?: unknown[] };
      if (result.ok !== true || !Array.isArray(result.processed) || result.processed.length === 0) break;
    }
  } catch {
    // The next event or manual worker call will claim the durable queue row.
  }
}
