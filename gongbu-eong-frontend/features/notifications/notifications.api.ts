import { apiClient } from "@/shared/api/client";
import type {
  NotificationReadResponseDto,
  NotificationsResponseDto,
} from "./notifications.dto";

export function getNotifications(args?: { limit?: number; offset?: number }) {
  const searchParams = new URLSearchParams();

  if (args?.limit != null) searchParams.set("limit", String(args.limit));
  if (args?.offset != null) searchParams.set("offset", String(args.offset));

  const query = searchParams.size ? `?${searchParams.toString()}` : "";
  return apiClient<NotificationsResponseDto>(`/api/notifications${query}`);
}

export function markNotificationRead(notificationId: string) {
  return apiClient<NotificationReadResponseDto>(
    `/api/notifications/${notificationId}/read`,
    { method: "POST" },
  );
}
