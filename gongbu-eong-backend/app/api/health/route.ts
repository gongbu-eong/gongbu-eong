import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/cors";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type HealthQueryResult = {
  now: Date;
};

export async function GET(request: NextRequest) {
  const database = await query<HealthQueryResult>("SELECT NOW() AS now");

  return jsonWithCors(request, {
    ok: true,
    service: "gongbu-eong-backend",
    role: "backend",
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      timestamp: database.rows[0].now,
    },
  });
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
