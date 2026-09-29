"use client";

import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import styles from "./My.module.css";

export function MyUserLoadError({ title }: { title: string }) {
  return (
    <div className={styles.page}>
      <AppHeader user={null} bookmarkCount={0} />
      <main className={styles.frame}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.error} role="alert">회원정보를 불러오지 못했습니다. 다시 시도해 주세요.</p>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => window.location.reload()}
        >
          다시 시도
        </button>
      </main>
      <AppFooter active="my" />
    </div>
  );
}
