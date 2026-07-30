import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { OAuthProfile, upsertOAuthUser } from "./auth.repository";

type OAuthProvider = "kakao" | "naver";
type EntrySource =
  | "main_home"
  | "diagnosis"
  | "job_detail"
  | "calendar"
  | "ai_tools"
  | "community"
  | "my_page"
  | "external_share"
  | "unknown";

const entrySources = new Set<EntrySource>([
  "main_home",
  "diagnosis",
  "job_detail",
  "calendar",
  "ai_tools",
  "community",
  "my_page",
  "external_share",
  "unknown",
]);

const providerConfig = {
  kakao: {
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    clientId: process.env.KAKAO_CLIENT_ID,
    redirectUri: process.env.KAKAO_REDIRECT_URI,
    scope: "",
  },
  naver: {
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    clientId: process.env.NAVER_CLIENT_ID,
    redirectUri: process.env.NAVER_REDIRECT_URI,
    scope: "name email",
  },
};

export function startOAuth(provider: OAuthProvider, request: NextRequest) {
  const config = providerConfig[provider];

  if (!config.clientId || !config.redirectUri) {
    return NextResponse.json(
      {
        ok: false,
        message: `${provider.toUpperCase()} OAuth environment values are not configured.`,
      },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = new URL(config.authorizeUrl);

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("state", state);

  if (config.scope) {
    authorizeUrl.searchParams.set("scope", config.scope);
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(`${provider}_oauth_state`, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  const entrySource = normalizeEntrySource(
    request.nextUrl.searchParams.get("entrySource"),
  );
  response.cookies.set("oauth_entry_source", entrySource, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  const diagnosisRunId = request.nextUrl.searchParams.get("diagnosisRunId");
  if (diagnosisRunId && isUuid(diagnosisRunId)) {
    response.cookies.set("oauth_diagnosis_run_id", diagnosisRunId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  const anonymousId = request.nextUrl.searchParams.get("anonymousId");
  if (anonymousId && isUuid(anonymousId)) {
    response.cookies.set("oauth_anonymous_id", anonymousId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  return response;
}

export async function handleOAuthCallback(provider: OAuthProvider, request: NextRequest) {
  const failureRedirectUrl =
    process.env.OAUTH_FAILURE_REDIRECT_URL ||
    "http://localhost:3000";
  const successRedirectUrl =
    process.env.OAUTH_SUCCESS_REDIRECT_URL ||
    "http://localhost:3000";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(`${provider}_oauth_state`)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      buildFailureRedirectUrl(failureRedirectUrl, provider),
    );
  }

  try {
    const token = await fetchOAuthToken(provider, code, state);
    const profile = await fetchOAuthProfile(provider, token.accessToken);
    const sessionToken = randomBytes(32).toString("hex");
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim();

    await upsertOAuthUser({
      profile,
      accessTokenHash: hashValue(token.accessToken),
      refreshTokenHash: token.refreshToken ? hashValue(token.refreshToken) : undefined,
      tokenExpiresAt: token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : undefined,
      sessionTokenHash: hashValue(sessionToken),
      entrySource: normalizeEntrySource(
        request.cookies.get("oauth_entry_source")?.value,
      ),
      diagnosisRunId: validUuidOrUndefined(
        request.cookies.get("oauth_diagnosis_run_id")?.value,
      ),
      anonymousId: validUuidOrUndefined(
        request.cookies.get("oauth_anonymous_id")?.value,
      ),
      ipAddress,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    const response = NextResponse.redirect(successRedirectUrl);
    response.cookies.delete(`${provider}_oauth_state`);
    response.cookies.delete("oauth_entry_source");
    response.cookies.delete("oauth_diagnosis_run_id");
    response.cookies.delete("oauth_anonymous_id");
    response.cookies.set("gongbu_eong_session", sessionToken, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch (error) {
    console.error(`[OAuth:${provider}] callback failed`, error);
    return NextResponse.redirect(
      buildFailureRedirectUrl(failureRedirectUrl, provider),
    );
  }
}

async function fetchOAuthToken(
  provider: OAuthProvider,
  code: string,
  state: string,
) {
  if (provider === "kakao") {
    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_CLIENT_ID || "",
        redirect_uri: process.env.KAKAO_REDIRECT_URI || "",
        code,
        ...(process.env.KAKAO_CLIENT_SECRET
          ? { client_secret: process.env.KAKAO_CLIENT_SECRET }
          : {}),
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error("Kakao token exchange failed.");
    }

    return {
      accessToken: body.access_token as string,
      refreshToken: body.refresh_token as string | undefined,
      expiresIn: body.expires_in as number | undefined,
    };
  }

  const response = await fetch("https://nid.naver.com/oauth2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NAVER_CLIENT_ID || "",
      client_secret: process.env.NAVER_CLIENT_SECRET || "",
      redirect_uri: process.env.NAVER_REDIRECT_URI || "",
      code,
      state,
    }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error("Naver token exchange failed.");
  }

  return {
    accessToken: body.access_token as string,
    refreshToken: body.refresh_token as string | undefined,
    expiresIn: body.expires_in ? Number(body.expires_in) : undefined,
  };
}

async function fetchOAuthProfile(
  provider: OAuthProvider,
  accessToken: string,
): Promise<OAuthProfile> {
  if (provider === "kakao") {
    const response = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error("Kakao profile fetch failed.");
    }

    return {
      provider,
      providerUserId: String(body.id),
      email: body.kakao_account?.email,
      nickname: body.kakao_account?.profile?.nickname,
      avatarUrl:
        body.kakao_account?.profile?.profile_image_url ||
        body.properties?.profile_image,
    };
  }

  const response = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json();

  if (!response.ok || body.resultcode !== "00") {
    throw new Error("Naver profile fetch failed.");
  }

  return {
    provider,
    providerUserId: body.response.id,
    email: body.response.email,
    nickname: body.response.nickname || body.response.name,
    avatarUrl: body.response.profile_image,
  };
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEntrySource(value?: string | null): EntrySource {
  if (!value) {
    return "unknown";
  }

  if (value === "main") {
    return "main_home";
  }

  return entrySources.has(value as EntrySource)
    ? (value as EntrySource)
    : "unknown";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function validUuidOrUndefined(value?: string) {
  return value && isUuid(value) ? value : undefined;
}

function buildFailureRedirectUrl(
  redirectUrl: string,
  provider: OAuthProvider,
) {
  const url = new URL(redirectUrl);
  if (url.pathname === "/") {
    url.pathname = "/login";
  }
  url.searchParams.set("oauthError", "callback_failed");
  url.searchParams.set("provider", provider);
  return url;
}
