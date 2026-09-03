"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import {
  getNotifications,
  markNotificationRead,
} from "../notifications.api";
import type { UserNotificationDto } from "../notifications.dto";
import styles from "./NotificationsPage.module.css";

type NotificationFilter = "all" | UserNotificationDto["category"];

const FILTERS: Array<{ key: NotificationFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "job_deadline", label: "공고·마감" },
  { key: "community", label: "커뮤니티" },
  { key: "coaching_credit", label: "코칭·크레딧" },
  { key: "notice", label: "공지" },
];

export function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<UserNotificationDto[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getNotifications({ limit: 100 })
      .then((response) => {
        if (!active) return;
        setItems(response.items);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "알림을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(
    () =>
      activeFilter === "all"
        ? items
        : items.filter((item) => item.category === activeFilter),
    [activeFilter, items],
  );
  const groups = useMemo(() => groupNotifications(filteredItems), [filteredItems]);

  const openNotification = async (notification: UserNotificationDto) => {
    if (pendingId) return;

    setPendingId(notification.id);
    try {
      let nextNotification = notification;
      if (!notification.readAt) {
        const response = await markNotificationRead(notification.id);
        nextNotification = response.notification;
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? response.notification : item,
          ),
        );
      }

      if (nextNotification.targetPath) {
        router.push(nextNotification.targetPath);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "알림을 처리하지 못했습니다.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.frame}>
        <AppHeader />
        <section className={styles.content}>
          <h1>알림</h1>
          <div className={styles.filters} aria-label="알림 필터">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={activeFilter === filter.key ? styles.activeFilter : undefined}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {message ? <p className={styles.message}>{message}</p> : null}
          {loading ? <p className={styles.empty}>알림을 불러오는 중이에요.</p> : null}
          {!loading && !filteredItems.length ? (
            <p className={styles.empty}>아직 받은 알림이 없어요.</p>
          ) : null}
          <div className={styles.groups}>
            {groups.map((group) => (
              <section key={group.key} className={styles.group}>
                <h2>{group.label}</h2>
                <ul className={styles.list}>
                  {group.items.map((notification) => (
                    <li key={notification.id}>
                      <NotificationCard
                        notification={notification}
                        disabled={pendingId === notification.id}
                        onClick={() => void openNotification(notification)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
        <AppFooter />
      </main>
    </div>
  );
}

function NotificationCard({
  notification,
  disabled,
  onClick,
}: {
  notification: UserNotificationDto;
  disabled: boolean;
  onClick: () => void;
}) {
  const isDeadline = notification.category === "job_deadline";
  const deadlineLabel = isDeadline ? getDeadlineBadge(notification) : null;
  const deadlineText = isDeadline ? getDeadlineText(notification) : null;

  return (
    <button
      type="button"
      className={[
        styles.item,
        isDeadline ? styles.deadlineItem : "",
        notification.readAt ? styles.read : "",
      ].filter(Boolean).join(" ")}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.itemTop}>
        <span className={styles.badge}>{getCategoryLabel(notification.category)}</span>
        {deadlineLabel ? <span className={styles.deadlineBadge}>{deadlineLabel}</span> : null}
        {!notification.readAt ? <i aria-label="읽지 않은 알림" /> : null}
      </span>
      <strong className={styles.body}>{notification.body}</strong>
      {deadlineText ? <span className={styles.deadlineInfo}>마감 : {deadlineText}</span> : null}
      <time>{formatRelativeTime(notification.createdAt)}</time>
    </button>
  );
}

function groupNotifications(items: UserNotificationDto[]) {
  const todayKey = formatDateKey(new Date());
  const grouped = new Map<string, UserNotificationDto[]>();

  for (const item of items) {
    const key = formatDateKey(new Date(item.createdAt));
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }

  return Array.from(grouped.entries()).map(([key, groupItems]) => ({
    key,
    label: key === todayKey ? "오늘" : formatGroupLabel(key),
    items: groupItems,
  }));
}

function getCategoryLabel(category: UserNotificationDto["category"]) {
  if (category === "job_deadline") return "공고·마감";
  if (category === "community") return "커뮤니티";
  if (category === "coaching_credit") return "코칭·크레딧";
  return "공지";
}

function getDeadlineBadge(notification: UserNotificationDto) {
  const offsetDays = Number(notification.metadata?.offsetDays);
  if (offsetDays === 0) return "마감임박 D-Day";
  if (Number.isFinite(offsetDays)) return `마감임박 D-${offsetDays}`;
  return "마감임박";
}

function getDeadlineText(notification: UserNotificationDto) {
  const value = notification.metadata?.applicationEndAt;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatGroupLabel(key: string) {
  const [, month, day] = key.split("-");
  if (!month || !day) return "";
  return `${month}.${day}`;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "방금 전";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
  return `${Math.floor(diffMs / day)}일 전`;
}
