import { NextRequest } from "next/server";
import { getDiagnosisStats } from "@/domains/diagnosis/diagnosis.service";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return jsonWithCors(request, await getDiagnosisStats());
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}
