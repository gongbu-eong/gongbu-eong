import { cookies } from "next/headers";
import { createHash, createHmac, randomUUID } from "crypto";
import { redirect } from "next/navigation";

export const EVENT_SESSION_COOKIE = "gongbu_eong_event_session";

const mainBackendUrl =
  process.env.GONGBUEONG_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";
export async function requireEventSession(eventNo: string, nextPath: string) {
  const cookieStore = await cookies();
  const eventSessionToken = cookieStore.get(EVENT_SESSION_COOKIE)?.value;

  if (!eventSessionToken) {
    await redirectToEntry(eventNo, nextPath);
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
    await redirectToEntry(eventNo, nextPath);
  }
}

export async function buildMainEventEntryUrl(eventNo: string, nextPath: string) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("gongbu_eong_session")?.value;
  const launchToken = signLaunchToken({
    eventNo,
    nextPath,
    sessionHash: sessionToken ? hashValue(sessionToken) : null,
  });
  const url = new URL(`/api/events/entry/${encodeURIComponent(eventNo)}`, mainBackendUrl);

  url.searchParams.set("next", nextPath);
  url.searchParams.set("launchToken", launchToken);
  return url.toString();
}

async function redirectToEntry(eventNo: string, nextPath: string): Promise<never> {
  redirect(await buildMainEventEntryUrl(eventNo, nextPath));
}

function signLaunchToken(payload: {
  eventNo: string;
  nextPath: string;
  sessionHash: string | null;
}) {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      nonce: randomUUID(),
    }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", getGatewaySecret())
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function getGatewaySecret() {
  const secret = process.env.EVENT_GATEWAY_SHARED_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("EVENT_GATEWAY_SHARED_SECRET is required in production.");
  }

  return "local-event-gateway-secret";
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
