const STORAGE_KEY = "gongbu_eong_job_bookmark_intent";
const MAX_AGE_MS = 30 * 60 * 1000;
export const BOOKMARK_INTENT_PARAM = "bookmarkIntent";

type BookmarkIntent = { jobId: string; token: string; createdAt: number };

export function rememberJobBookmark(jobId: string) {
  try {
    const token = crypto.randomUUID();
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ jobId, token, createdAt: Date.now() }),
    );
    return `/jobs/${encodeURIComponent(jobId)}?${BOOKMARK_INTENT_PARAM}=${token}`;
  } catch {
    return null;
  }
}

export function readJobBookmarkIntent(
  jobId: string,
  token: string | null,
): BookmarkIntent | null {
  if (!token) return null;
  try {
    const intent = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) || "null",
    ) as BookmarkIntent | null;
    if (
      !intent || intent.jobId !== jobId || intent.token !== token ||
      typeof intent.createdAt !== "number"
    ) return null;
    const age = Date.now() - intent.createdAt;
    if (age < 0 || age > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export function completeJobBookmarkIntent(jobId: string, token: string | null) {
  if (!readJobBookmarkIntent(jobId, token)) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be disabled during login.
  }
  const url = new URL(window.location.href);
  if (url.pathname === `/jobs/${jobId}` && url.searchParams.get(BOOKMARK_INTENT_PARAM) === token) {
    url.searchParams.delete(BOOKMARK_INTENT_PARAM);
    window.history.replaceState(
      window.history.state, "", `${url.pathname}${url.search}${url.hash}`,
    );
  }
}
