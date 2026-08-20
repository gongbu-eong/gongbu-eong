import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return proxyKakaoShareCallback(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyKakaoShareCallback(request, "POST");
}

async function proxyKakaoShareCallback(request: NextRequest, method: "GET" | "POST") {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:4000";
  const targetUrl = new URL("/api/diagnosis/share-callback", backendUrl);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: method === "POST" ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
