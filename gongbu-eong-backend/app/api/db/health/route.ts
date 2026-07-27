import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/cors";
import { query } from "@/lib/db";

export const runtime = "nodejs";

type DatabaseHealthRow = {
  database_name: string;
  current_user: string;
  server_time: Date;
};

export async function GET(request: NextRequest) {
  const result = await query<DatabaseHealthRow>(`
    SELECT
      current_database() AS database_name,
      current_user AS current_user,
      NOW() AS server_time
  `);

  return jsonWithCors(request, {
    ok: true,
    database: result.rows[0],
  });
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
