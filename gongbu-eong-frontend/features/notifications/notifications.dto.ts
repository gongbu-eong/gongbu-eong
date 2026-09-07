export type UserNotificationDto = {
  id: string;
  channel: "in_app" | "kakao" | "kakao_alimtalk" | "email" | "sms" | "push";
  category: "job_deadline" | "community" | "coaching_credit" | "notice";
  kind: string | null;
  title: string;
  body: string;
  targetPath: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationsResponseDto = {
  ok: boolean;
  items: UserNotificationDto[];
  unreadCount: number;
  limit: number;
  offset: number;
};

export type NotificationReadResponseDto = {
  ok: boolean;
  notification: UserNotificationDto;
  unreadCount: number;
};
