import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/cors";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const studyItems = [
  {
    id: "nextjs-api",
    title: "Next.js API route",
    status: "ready",
  },
  {
    id: "cors",
    title: "CORS configured",
    status: "ready",
  },
  {
    id: "frontend-client",
    title: "Frontend HTTP client",
    status: "ready",
  },
];

export async function GET(request: NextRequest) {
  const database = await query<{ server_time: Date }>(
    "SELECT NOW() AS server_time",
  );

  return jsonWithCors(request, {
    items: studyItems,
    database: {
      connected: true,
      serverTime: database.rows[0].server_time,
    },
  });
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
