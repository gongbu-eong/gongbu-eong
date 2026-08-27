"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { withdrawCurrentUser } from "@/features/my/my.api";
import type { WithdrawalReasonCode } from "@/features/my/my.dto";
import styles from "./My.module.css";

const withdrawalReasons: Array<{
  code: WithdrawalReasonCode;
  label: string;
}> = [
  { code: "content_lack", label: "콘텐츠 내용 부족" },
  { code: "low_usage", label: "사용빈도 낮음" },
  { code: "privacy_concern", label: "개인정보 유출 우려" },
  { code: "inconvenient", label: "사이트 이용 불편" },
  { code: "other", label: "기타" },
];

export function MyWithdrawalPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [noticeAgreed, setNoticeAgreed] = useState(false);
  const [reasonCode, setReasonCode] = useState<WithdrawalReasonCode | "">("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      const response = await getCurrentUser().catch(() => null);

      if (!alive) return;

      if (!response?.authenticated || !response.user) {
        router.replace("/login");
        return;
      }

      setUser(response.user);
      setIsCheckingAuth(false);
    }

    void loadUser();

    return () => {
      alive = false;
    };
  }, [router]);

  const nickname = useMemo(
    () => user?.communityNickname || "프로필 닉네임 설정",
    [user],
  );

  const canSubmit =
    noticeAgreed &&
    Boolean(reasonCode) &&
    (reasonCode !== "other" || reasonDetail.trim().length > 0) &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!noticeAgreed) {
      setError("탈퇴 안내 사항에 동의해 주세요.");
      return;
    }

    if (!reasonCode) {
      setError("탈퇴 사유를 선택해주세요.");
      return;
    }

    if (reasonCode === "other" && !reasonDetail.trim()) {
      setError("기타 사유를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await withdrawCurrentUser({
        noticeAgreed,
        reasonCode,
        reasonDetail: reasonCode === "other" ? reasonDetail.trim() : null,
      });
      setCompleted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "회원 탈퇴 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goHome = () => {
    router.replace("/");
    router.refresh();
  };

  if (isCheckingAuth) {
    return null;
  }

  return (
    <div className={`${styles.page} ${styles.withdrawalPage}`}>
      <AppHeader user={user} nickname={nickname} bookmarkCount={0} />
      <main className={styles.withdrawalFrame}>
        <h1 className={styles.title}>탈퇴 안내</h1>
        <p className={styles.withdrawalIntro}>
          회원 탈퇴를 신청하기 전에 <strong>안내 사항</strong>을 꼭! 확인해주세요.
        </p>

        <section className={styles.withdrawalNotice} aria-label="탈퇴 안내 사항">
          <ul>
            <li>공부엉이를 탈퇴한 뒤 다시 공부엉이를 가입해도 이전 계정 데이터는 복원되지 않습니다.</li>
            <li>탈퇴시 회원님의 개인정보는 개인정보처리방침에 따라 탈퇴일로부터 30일간 보관 후 삭제됩니다.</li>
            <li>공부엉이에서 작성하신 게시물, 댓글은 탈퇴 후에도 삭제되지 않으므로 게시물, 댓글의 삭제를 원하시는 경우 반드시 직접 삭제하신 후 탈퇴해 주시기 바랍니다.</li>
          </ul>
        </section>

        <label className={styles.withdrawalConsent}>
          <input
            type="checkbox"
            checked={noticeAgreed}
            onChange={(event) => setNoticeAgreed(event.target.checked)}
          />
          <span>위 안내 사항을 모두 확인하였으며, 동의합니다.</span>
        </label>

        <section className={styles.withdrawalReasons} aria-labelledby="withdrawalReasonTitle">
          <h2 id="withdrawalReasonTitle">탈퇴 사유</h2>
          <div className={styles.withdrawalReasonList}>
            {withdrawalReasons.map((reason) => (
              <label key={reason.code} className={styles.withdrawalReasonItem}>
                <input
                  type="radio"
                  name="withdrawalReason"
                  value={reason.code}
                  checked={reasonCode === reason.code}
                  onChange={() => {
                    setReasonCode(reason.code);
                    setError("");
                  }}
                />
                <span>{reason.label}</span>
              </label>
            ))}
          </div>

          {reasonCode === "other" ? (
            <textarea
              className={styles.withdrawalReasonDetail}
              value={reasonDetail}
              maxLength={1000}
              aria-label="기타 탈퇴 사유"
              onChange={(event) => setReasonDetail(event.target.value)}
            />
          ) : null}
        </section>

        {error ? (
          <p className={styles.withdrawalError} role="alert">
            {error}
          </p>
        ) : !reasonCode ? (
          <p className={styles.withdrawalError}>탈퇴 사유를 선택해주세요.</p>
        ) : null}

        <div className={styles.withdrawalActions}>
          <Link href="/my" className={styles.withdrawalCancelButton}>
            취소
          </Link>
          <button
            type="button"
            className={styles.withdrawalSubmitButton}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {isSubmitting ? "탈퇴 처리 중..." : "탈퇴 하기"}
          </button>
        </div>
      </main>
      <AppFooter active="my" />

      {completed ? (
        <div className={styles.withdrawalModalBackdrop} role="presentation">
          <section className={styles.withdrawalModal} role="alertdialog" aria-modal="true" aria-labelledby="withdrawalCompleteTitle">
            <h2 id="withdrawalCompleteTitle">탈퇴가 완료되었습니다.</h2>
            <p>
              그동안 공부엉이를 이용해 주셔서 감사합니다.
              <br />
              더 좋은 서비스를 제공하기 위해 노력하겠습니다.
            </p>
            <button type="button" onClick={goHome}>
              메인으로 가기
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
