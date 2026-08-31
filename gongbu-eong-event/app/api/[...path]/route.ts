import { NextRequest, NextResponse } from "next/server";
import { EVENT_SESSION_COOKIE } from "@/shared/event-session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const mainBackendUrl =
  process.env.GONGBUEONG_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

async function proxyToBackend(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = new URL(`/api/${path.join("/")}`, mainBackendUrl);
  targetUrl.search = request.nextUrl.search;
  const eventSessionToken = request.cookies.get(EVENT_SESSION_COOKIE)?.value;
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (["connection", "content-length", "host"].includes(key.toLowerCase())) {
      return;
    }

    headers.set(key, value);
  });

  if (eventSessionToken) {
    headers.set("x-gongbu-event-session", eventSessionToken);
  }

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody(request.method) ? await request.arrayBuffer() : undefined,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

function hasBody(method: string) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}
