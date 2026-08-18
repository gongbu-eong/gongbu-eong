"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { getCoachingResult } from "@/features/coaching/coaching.api";
import type { CoachingHistoryItem } from "@/features/coaching/coaching.dto";
import { CoachingResultView } from "@/features/coaching/components/CoachingResultView";
import styles from "@/features/coaching/components/CoachingPage.module.css";

export default function CoachingResultPage() {
  const params = useParams<{ resultId: string }>();
  const [item, setItem] = useState<CoachingHistoryItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.resultId) return;
    getCoachingResult(params.resultId)
      .then((response) => setItem(response.item))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "결과를 불러오지 못했습니다."));
  }, [params.resultId]);

  if (item?.result) return <CoachingResultView item={{ inputType: item.inputType, inputText: item.inputText, sourceFilename: item.sourceFilename, job: item.job, result: item.result }} />;

  return <div className={styles.page}>
    <AppHeader />
    <main className={`${styles.frame} ${styles.newResultScreen}`}>
      {error ? <p className={styles.error}>{error}</p> : <p className={styles.loading}>결과를 불러오는 중...</p>}
    </main>
    <AppFooter active="ai" />
  </div>;
}
