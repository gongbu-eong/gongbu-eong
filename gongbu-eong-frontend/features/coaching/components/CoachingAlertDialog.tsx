"use client";

import Image from "next/image";
import { useId } from "react";
import styles from "./CoachingPage.module.css";

export function CoachingAlertDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const titleId = useId();

  return (
    <div className={styles.dialogOverlay} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <section className={styles.figmaDialog}>
        <div className={styles.dialogVisual}>
          <Image src="/coaching/coaching-alert-bg.svg" alt="" width={207} height={125} className={styles.dialogBg} />
          <Image src="/coaching/coaching-alert-owl.png" alt="" width={172} height={167} className={styles.alertOwl} priority />
        </div>
        <h2 id={titleId}>{message}</h2>
        <button className={styles.alertConfirmButton} type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  );
}
