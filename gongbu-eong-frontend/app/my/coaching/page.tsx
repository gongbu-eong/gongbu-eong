"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { listCoachingHistory } from "@/features/coaching/coaching.api";
import type { CoachingHistoryItem } from "@/features/coaching/coaching.dto";
import styles from "@/features/coaching/components/CoachingPage.module.css";

export default function CoachingHistoryPage() {
  const [items, setItems] = useState<CoachingHistoryItem[]>([]);
  useEffect(() => { listCoachingHistory().then((response) => setItems(response.items)).catch(() => setItems([])); }, []);
  return <div className={styles.page}><AppHeader /><main className={styles.frame}><h1>내 자소서 코칭 기록</h1>{items.length ? items.map((item) => <Link className={styles.selectedJob} href={`/my/coaching/${item.id}`} key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("ko-KR")} · {item.inputType === "file" ? item.sourceFilename : "직접 입력"}</span><strong>{item.job ? `${item.job.institutionName} · ${item.job.title}` : "일반 자소서 코칭"}</strong><b>{item.result?.grade} · {item.result?.score}점</b></Link>) : <div className={styles.emptyCard}><p>저장된 자소서 코칭 기록이 없습니다.</p><Link href="/ai-tools/coaching">자소서 코칭 받기 →</Link></div>}</main><AppFooter active="my" /></div>;
}
