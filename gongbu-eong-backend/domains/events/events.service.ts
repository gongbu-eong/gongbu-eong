import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { findUserBySessionTokenHash } from "@/domains/auth/auth.repository";
import {
  consumeEventEntryTicket,
  findEventByNo,
  insertEventEntryTicket,
  validateEventSession,
} from "./events.repository";

const MAIN_SESSION_COOKIE = "gongbu_eong_session";
const TICKET_TTL_MS = 5 * 60 * 1000;
const LAUNCH_TOKEN_TTL_MS = 2 * 60 * 1000;
const LOCAL_GATEWAY_SECRET = "local-event-gateway-secret";

type CurrentSession = {
  sessionTokenHash: string | null;
  userId: string | null;
};

export class EventError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "EventError";
  }
}

export async function createEventEntryRedirect(args: {
  request: NextRequest;
  eventNo: string;
  nextPath?: string | null;
  sourcePath?: string | null;
  launchToken?: string | null;
}) {
  const event = await findEventByNo(args.eventNo);

  if (!event || !isEventActive(event)) {
    throw new EventError("이벤트가 진행 중이 아닙니다.", 404, "event_inactive");
  }

  const currentSession = await getCurrentSession(args.request);
  const returnPath = normalizeEventPath(args.nextPath, event.entry_path, event.result_path);

  verifyLaunchToken({
    launchToken: args.launchToken,
    eventNo: args.eventNo,
    nextPath: returnPath,
    sessionTokenHash: currentSession.sessionTokenHash,
  });

  const ticket = randomToken();
  const ticketHash = hashValue(ticket);
  const eventBaseUrl = getEventBaseUrl(event.event_base_url);

  await insertEventEntryTicket({
    eventId: event.id,
    ticketHash,
    userId: currentSession.userId,
    sessionTokenHash: currentSession.sessionTokenHash,
    returnPath,
    sourcePath: args.sourcePath,
    ipAddress: getRequestIp(args.request),
    userAgent: args.request.headers.get("user-agent"),
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  });

  const redirectUrl = new URL("/api/event-entry", eventBaseUrl);
  redirectUrl.searchParams.set("ticket", ticket);
  redirectUrl.searchParams.set("next", returnPath);

  return redirectUrl.toString();
}

export async function consumeEventTicket(args: {
  request: NextRequest;
  ticket: string;
}) {
  const currentSession = await getCurrentSession(args.request);
  const eventSessionToken = randomToken();
  const result = await consumeEventEntryTicket({
    ticketHash: hashValue(args.ticket),
    eventSessionTokenHash: hashValue(eventSessionToken),
    currentSessionTokenHash: currentSession.sessionTokenHash,
  });

  if (!result.ok) {
    throw new EventError(
      "이벤트 진입 권한을 확인할 수 없습니다.",
      401,
      result.reason,
    );
  }

  return {
    eventNo: result.eventNo,
    eventSessionToken,
    returnPath: result.returnPath,
    expiresAt: result.expiresAt.toISOString(),
  };
}

export async function validateEventSessionToken(args: {
  eventNo: string;
  eventSessionToken: string;
}) {
  const session = await validateEventSession({
    eventNo: args.eventNo,
    sessionTokenHash: hashValue(args.eventSessionToken),
  });

  if (!session) {
    throw new EventError("이벤트 세션이 유효하지 않습니다.", 401, "invalid_event_session");
  }

  return {
    eventNo: session.event_no,
    userId: session.user_id,
    expiresAt: new Date(session.expires_at).toISOString(),
  };
}

async function getCurrentSession(request: NextRequest): Promise<CurrentSession> {
  const sessionToken = request.cookies.get(MAIN_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return { sessionTokenHash: null, userId: null };
  }

  const sessionTokenHash = hashValue(sessionToken);
  const user = await findUserBySessionTokenHash(sessionTokenHash);

  return {
    sessionTokenHash,
    userId: user?.id ?? null,
  };
}

function isEventActive(event: {
  status: string;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
}) {
  const now = new Date();
  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;

  return (
    event.status === "active" &&
    (!startsAt || startsAt <= now) &&
    (!endsAt || endsAt >= now)
  );
}

function normalizeEventPath(
  value: string | null | undefined,
  entryPath: string,
  resultPath: string | null,
) {
  if (!value) {
    return entryPath;
  }

  const fallbackOrigin = "https://event.local";
  const parsed = new URL(value, fallbackOrigin);
  const allowedPaths = new Set([entryPath]);

  if (resultPath) {
    allowedPaths.add(resultPath);
  }

  if (!allowedPaths.has(parsed.pathname)) {
    return entryPath;
  }

  return `${parsed.pathname}${parsed.search}`;
}

function getEventBaseUrl(eventBaseUrl?: string | null) {
  return (
    eventBaseUrl ||
    process.env.GONGBUEONG_EVENT_URL ||
    process.env.NEXT_PUBLIC_EVENT_URL ||
    "http://localhost:3001"
  );
}

function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function verifyLaunchToken(args: {
  launchToken?: string | null;
  eventNo: string;
  nextPath: string;
  sessionTokenHash: string | null;
}) {
  if (!args.launchToken) {
    throw new EventError("이벤트 진입 토큰이 필요합니다.", 401, "missing_launch_token");
  }

  const [body, signature] = args.launchToken.split(".");

  if (!body || !signature) {
    throw new EventError("이벤트 진입 토큰이 올바르지 않습니다.", 401, "invalid_launch_token");
  }

  const expectedSignature = createHmac("sha256", getGatewaySecret())
    .update(body)
    .digest("base64url");

  if (!isSameSignature(signature, expectedSignature)) {
    throw new EventError("이벤트 진입 토큰 서명이 올바르지 않습니다.", 401, "invalid_launch_token");
  }

  let payload: {
    eventNo?: string;
    nextPath?: string;
    sessionHash?: string | null;
    iat?: number;
  };

  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new EventError("이벤트 진입 토큰을 읽을 수 없습니다.", 401, "invalid_launch_token");
  }

  if (
    payload.eventNo !== args.eventNo ||
    payload.nextPath !== args.nextPath ||
    (payload.sessionHash ?? null) !== args.sessionTokenHash ||
    typeof payload.iat !== "number" ||
    Date.now() - payload.iat > LAUNCH_TOKEN_TTL_MS
  ) {
    throw new EventError("이벤트 진입 토큰이 만료되었거나 일치하지 않습니다.", 401, "invalid_launch_token");
  }
}

function isSameSignature(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getGatewaySecret() {
  const secret = process.env.EVENT_GATEWAY_SHARED_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new EventError(
      "EVENT_GATEWAY_SHARED_SECRET is required in production.",
      500,
      "missing_gateway_secret",
    );
  }

  return LOCAL_GATEWAY_SECRET;
}

function randomToken() {
  return randomBytes(32).toString("hex");
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
