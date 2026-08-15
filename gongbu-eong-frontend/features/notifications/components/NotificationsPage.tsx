"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import {
  getNotifications,
  markNotificationRead,
} from "../notifications.api";
import type { UserNotificationDto } from "../notifications.dto";
import styles from "./NotificationsPage.module.css";

export function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<UserNotificationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getNotifications()
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

  const openNotification = async (notification: UserNotificationDto) => {
    if (pendingId) return;

    setPendingId(notification.id);
    try {
      if (!notification.readAt) {
        const response = await markNotificationRead(notification.id);
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? response.notification : item,
          ),
        );
      }

      if (notification.targetPath) {
        router.push(notification.targetPath);
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
          {message ? <p className={styles.message}>{message}</p> : null}
          {loading ? <p className={styles.empty}>알림을 불러오는 중이에요.</p> : null}
          {!loading && !items.length ? (
            <p className={styles.empty}>아직 받은 알림이 없어요.</p>
          ) : null}
          <ul className={styles.list}>
            {items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className={`${styles.item} ${notification.readAt ? styles.read : ""}`}
                  disabled={pendingId === notification.id}
                  onClick={() => void openNotification(notification)}
                >
                  <span className={styles.itemTop}>
                    <strong>{notification.title}</strong>
                    {!notification.readAt ? <em>NEW</em> : null}
                  </span>
                  <span className={styles.body}>{notification.body}</span>
                  <time>{formatDate(notification.createdAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <AppFooter />
      </main>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
