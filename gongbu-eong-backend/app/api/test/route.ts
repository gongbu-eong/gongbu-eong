import { NextRequest } from "next/server";
import { jsonWithCors } from "@/lib/cors";
import { TestRowsResponseDto } from "@/domains/test/test.dto";
import { findTestRows } from "@/domains/test/test.repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const result = await findTestRows();
  const responseBody: TestRowsResponseDto = {
    items: result.rows,
  };

  return jsonWithCors(request, responseBody);
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
