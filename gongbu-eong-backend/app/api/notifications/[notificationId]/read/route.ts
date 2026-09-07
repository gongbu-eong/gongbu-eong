import { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import {
  countUnreadNotifications,
  markNotificationRead,
} from "@/domains/notifications/notifications.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { notificationId } = await context.params;
    const notification = await markNotificationRead(user.id, notificationId);

    if (!notification) {
      return jsonWithCors(
        request,
        { ok: false, message: "알림을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const unreadCount = await countUnreadNotifications(user.id);

    return jsonWithCors(request, { ok: true, notification, unreadCount });
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

function handleError(request: NextRequest, error: unknown) {
  const status =
    error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;
  const message =
    error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";

  return jsonWithCors(request, { ok: false, message }, { status });
}
