import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { listUserNotifications } from "@/domains/notifications/notifications.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const searchParams = request.nextUrl.searchParams;
    const limit = clampNumber(searchParams.get("limit"), 30, 1, 100);
    const offset = clampNumber(searchParams.get("offset"), 0, 0, 10000);
    const notifications = await listUserNotifications(user.id, {
      limit,
      offset,
    });

    return jsonWithCors(request, { ok: true, ...notifications, limit, offset });
  } catch (error) {
    return handleError(request, error);
  }
}

export function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: jsonWithCors(request, null).headers,
  });
}

function clampNumber(
  value: string | null,
  defaultValue: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function handleError(request: NextRequest, error: unknown) {
  const status =
    error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
  const message =
    error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";

  return jsonWithCors(request, { ok: false, message }, { status });
}
