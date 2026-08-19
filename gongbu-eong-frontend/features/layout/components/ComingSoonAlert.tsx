"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import styles from "./ComingSoonAlert.module.css";

export function ComingSoonAlert({
  onClose,
}: {
  onClose: () => void;
}) {
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
        <h2 id="coming-soon-alert-title">아직 준비중입니다.</h2>
        <p>조금만 기다려주세요.</p>
        <button type="button" onClick={onClose}>
          확인
        </button>
      </section>
    </div>,
    document.body,
  );
}
