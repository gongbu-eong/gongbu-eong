"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { listResumes } from "@/features/my/my.api";
import type { ResumeDto } from "@/features/my/my.dto";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export default function DownloadTestPage() {
  const [resumes, setResumes] = useState<ResumeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listResumes()
      .then((response) => {
        if (!active) return;
        setResumes(response.resumes);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "이력서 파일 목록을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const files = useMemo(
    () => resumes.filter((resume) => resume.file),
    [resumes],
  );

  return (
    <main style={styles.page}>
      <section style={styles.frame}>
        <h1 style={styles.title}>NHN 파일 다운로드 테스트</h1>
        <p style={styles.description}>
          파일 다운로드를 테스트합니다.
        </p>

        {loading ? <p style={styles.message}>파일 목록을 불러오는 중입니다.</p> : null}
        {message ? <p style={styles.error}>{message}</p> : null}
        {!loading && !files.length ? (
          <p style={styles.message}>다운로드 테스트 가능한 이력서 파일이 없습니다.</p>
        ) : null}

        <div style={styles.list}>
          {files.map((resume) => {
            const file = resume.file!;
            const downloadUrl = `${backendUrl}/api/resumes/files/${file.id}/download`;

            return (
              <article key={file.id} style={styles.card}>
                <small style={styles.resumeTitle}>{resume.title}</small>
                <strong style={styles.fileName}>{file.originalFilename}</strong>
                <dl style={styles.meta}>
                </dl>
                <a href={downloadUrl} style={styles.button}>
                  다운로드 테스트
                </a>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatBytes(value: number | null | undefined) {
  if (!value) return "-";
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

const styles = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    justifyContent: "center",
    background: "#f5f7fa",
    color: "#1a2233",
    fontFamily: "Pretendard, system-ui, sans-serif",
  },
  frame: {
    width: "100%",
    maxWidth: "600px",
    minHeight: "100dvh",
    padding: "24px 16px",
    background: "#fff",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "22px",
    fontWeight: 800,
  },
  description: {
    margin: "0 0 20px",
    color: "#5a6580",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  message: {
    display: "grid",
    minHeight: "120px",
    placeItems: "center",
    borderRadius: "10px",
    background: "#f5f7fa",
    color: "#7b8497",
    fontSize: "14px",
  },
  error: {
    padding: "12px",
    borderRadius: "8px",
    background: "#fff4e5",
    color: "#8a5a00",
    fontSize: "13px",
  },
  list: {
    display: "grid",
    gap: "10px",
  },
  card: {
    display: "grid",
    gap: "10px",
    padding: "16px",
    border: "1px solid #e4e8ef",
    borderRadius: "10px",
    background: "#fff",
  },
  resumeTitle: {
    color: "#7b8497",
    fontSize: "12px",
  },
  fileName: {
    fontSize: "15px",
    lineHeight: 1.35,
    wordBreak: "break-all" as const,
  },
  meta: {
    display: "grid",
    gap: "6px",
    margin: 0,
    color: "#5a6580",
    fontSize: "12px",
  },
  button: {
    display: "flex",
    height: "44px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background: "#2f7ff0",
    color: "#fff",
    textDecoration: "none",
    fontSize: "15px",
    fontWeight: 800,
  },
} satisfies Record<string, CSSProperties>;
