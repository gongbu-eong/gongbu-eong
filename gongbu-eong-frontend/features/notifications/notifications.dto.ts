export type UserNotificationDto = {
  id: string;
  title: string;
  body: string;
  targetPath: string | null;
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
};
