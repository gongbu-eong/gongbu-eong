import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/cors";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type HealthQueryResult = {
  now: Date;
};

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    return jsonWithCors(
      request,
      {
        ok: false,
        service: "gongbu-eong-backend",
        role: "backend",
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          message:
            error instanceof Error
              ? error.message
              : "Unknown database connection error",
        },
      },
      { status: 500 },
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
