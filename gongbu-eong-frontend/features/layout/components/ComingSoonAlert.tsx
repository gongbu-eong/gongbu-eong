"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import styles from "./ComingSoonAlert.module.css";

export function ComingSoonAlert({
  onClose,
  title = "아직 준비중입니다.",
  description = "조금만 기다려주세요.",
  confirmLabel = "확인",
}: {
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  useBodyScrollLock(true);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} role="presentation">
      <button
        type="button"
        className={styles.dim}
        aria-label="안내 닫기"
        onClick={onClose}
      />
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="coming-soon-alert-title"
        aria-describedby={description ? "coming-soon-alert-description" : undefined}
      >
        <span className={styles.owlStage} aria-hidden="true">
          <Image
            src="/home/home-coming-soon-bg.svg"
            alt=""
            width={207}
            height={124}
            className={styles.owlBg}
          />
          <Image
            src="/home/home-coming-soon-owl.png"
            alt=""
            width={125}
            height={168}
            className={styles.owl}
          />
        </span>
        <h2 id="coming-soon-alert-title">{title}</h2>
        {description ? <p id="coming-soon-alert-description">{description}</p> : null}
        <button type="button" onClick={onClose}>
          {confirmLabel}
        </button>
      </section>
    </div>,
    document.body,
  );
}
