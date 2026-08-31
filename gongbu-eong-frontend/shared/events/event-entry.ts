import { createHash, createHmac, randomUUID } from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "gongbu_eong_session";
const LOCAL_GATEWAY_SECRET = "local-event-gateway-secret";

export async function buildSignedEventEntryUrl(eventNo: string, nextPath: string) {
  const backendUrl =
    process.env.GONGBUEONG_BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:4000";
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;
  const launchToken = signLaunchToken({
    eventNo,
    nextPath,
    sessionHash: sessionToken ? hashValue(sessionToken) : null,
  });
  const url = new URL(`/api/events/entry/${encodeURIComponent(eventNo)}`, backendUrl);

  url.searchParams.set("next", nextPath);
  url.searchParams.set("launchToken", launchToken);

  return url.toString();
}

function signLaunchToken(payload: {
  eventNo: string;
  nextPath: string;
  sessionHash: string | null;
}) {
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Date.now(),
      nonce: randomUUID(),
    }),
  );
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

  return LOCAL_GATEWAY_SECRET;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
