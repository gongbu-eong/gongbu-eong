import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

function getAllowedOrigins() {
  const origins = process.env.CORS_ALLOWED_ORIGINS;

  if (!origins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsHeaders(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Gongbu-Event-Session",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export function jsonWithCors(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...getCorsHeaders(request),
      ...init?.headers,
    },
  });
}
