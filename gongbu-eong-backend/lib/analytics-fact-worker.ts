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
    // One user action can enqueue multiple scopes. Drain a full bounded batch
    // so initial backlog does not persist one three-item wake-up at a time.
    await fetch(`${baseUrl}/api/internal/analytics/facts/process?limit=20`, {
      method: "POST",
      headers: { "x-analytics-fact-worker-key": key },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // The next event or manual worker call will claim the durable queue row.
  }
}
