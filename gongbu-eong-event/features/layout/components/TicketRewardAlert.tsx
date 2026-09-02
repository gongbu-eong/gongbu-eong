"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import styles from "./TicketRewardAlert.module.css";

export function TicketRewardAlert({
  message = "진단권 한장이 추가되었습니다.",
  onClose,
}: {
  message?: string;
  onClose: () => void;
}) {
  const isHydrated = useHydrated();
  useBodyScrollLock(isHydrated);

  const alert = (
    <div className={styles.overlay} role="presentation">
      <div className={styles.dim} />
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ticket-reward-title"
      >
        <Image
          src="/tickets/reward-owl.png"
          alt=""
          width={202}
          height={168}
          className={styles.image}
          priority
        />
        <h2 id="ticket-reward-title">축하드립니다~!</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );

  if (!isHydrated) return null;
  return createPortal(alert, document.body);
}

function useHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => {
      onStoreChange();
      return () => {};
    },
    () => true,
    () => false,
  );
}
