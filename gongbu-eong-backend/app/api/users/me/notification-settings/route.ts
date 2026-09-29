import { NextRequest } from "next/server";
import { normalizePhoneNumber } from "@/domains/profile/phone-number";
import { requireSessionUser } from "@/domains/auth/session";
import {
  DEADLINE_NOTIFICATION_OFFSETS,
  findNotificationSettings,
  updateNotificationSettings,
  type DeadlineNotificationOffset,
} from "@/domains/notifications/notification-settings.repository";
import { jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const settings = await findNotificationSettings(user.id);

    if (!settings) {
      return jsonWithCors(
        request,
        { ok: false, message: "알림 설정을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return jsonWithCors(request, { ok: true, settings });
  } catch (error) {
    return handleError(request, error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const payload = await request.json().catch(() => null);
    const input = readNotificationPayload(payload);
    const forwardedFor = request.headers.get("x-forwarded-for");
    const settings = await updateNotificationSettings(user.id, {
      ...input,
      ipAddress: forwardedFor?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!settings) {
      return jsonWithCors(
        request,
        { ok: false, message: "알림 설정을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return jsonWithCors(request, { ok: true, settings });
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

function readNotificationPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw badRequest("알림 설정 정보를 확인해 주세요.");
  }

  const value = payload as Record<string, unknown>;
  const phoneNumber = normalizePhoneNumber(value.phoneNumber);
  const kakaoConnected = Boolean(value.kakaoConnected);
  const deadlineEnabled = Boolean(value.deadlineEnabled);
  const deadlineOffsets = readDeadlineOffsets(value.deadlineOffsets);
  const marketingAgreed = Boolean(value.marketingAgreed);

  if (kakaoConnected && !phoneNumber) {
    throw badRequest("알림 받을 전화번호를 입력해 주세요.");
  }

  if (deadlineEnabled && deadlineOffsets.length === 0) {
    throw badRequest("접수 마감 임박 알림 시점을 선택해 주세요.");
  }

  return {
    phoneNumber,
    kakaoConnected,
    deadlineEnabled,
    deadlineOffsets,
    marketingAgreed,
  };
}

function readDeadlineOffsets(value: unknown) {
  if (!Array.isArray(value)) return [3] as DeadlineNotificationOffset[];

  const offsets = value
    .map((item) => Number(item))
    .filter((item): item is DeadlineNotificationOffset =>
      DEADLINE_NOTIFICATION_OFFSETS.includes(
        item as DeadlineNotificationOffset,
      ),
    );

  return Array.from(new Set(offsets));
}

function badRequest(message: string) {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
}

function handleError(request: NextRequest, error: unknown) {
  const status =
    error instanceof Error && error.name === "UnauthorizedError"
      ? 401
      : error instanceof Error && error.name === "BadRequestError"
        ? 400
        : 500;
  const message =
    error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";

  return jsonWithCors(request, { ok: false, message }, { status });
}
