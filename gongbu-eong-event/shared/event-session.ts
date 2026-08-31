import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const EVENT_SESSION_COOKIE = "gongbu_eong_event_session";

const mainBackendUrl =
  process.env.GONGBUEONG_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";
const mainAppUrl =
  process.env.GONGBUEONG_MAIN_URL ||
  process.env.NEXT_PUBLIC_MAIN_APP_URL ||
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  "http://localhost:3000";

export async function requireEventSession(eventNo: string, nextPath: string) {
  const cookieStore = await cookies();
  const eventSessionToken = cookieStore.get(EVENT_SESSION_COOKIE)?.value;

  if (!eventSessionToken) {
    redirectToEntry(eventNo, nextPath);
  }

  const response = await fetch(`${mainBackendUrl}/api/events/sessions/validate`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventNo,
      eventSessionToken,
    }),
  });

  if (!response.ok) {
    redirectToEntry(eventNo, nextPath);
  }
}

export function buildMainEventEntryUrl(eventNo: string, nextPath: string) {
  const legacyPath =
    eventNo === "1" && nextPath.startsWith("/events/diagnosis/result")
      ? "/ai-tools/diagnosis/result"
      : "/ai-tools/diagnosis";
  const url = new URL(legacyPath, mainAppUrl);
  const parsedNext = new URL(nextPath, "https://event.local");

  parsedNext.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function redirectToEntry(eventNo: string, nextPath: string): never {
  redirect(buildMainEventEntryUrl(eventNo, nextPath));
}
