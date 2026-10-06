"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getHomeJobs } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { MyUserLoadError } from "./MyUserLoadError";
import {
  getMyNotificationSettings,
  updateMyNotificationSettings,
} from "../my.api";
import type {
  DeadlineNotificationOffset,
  NotificationSettingsPayloadDto,
} from "../my.dto";
import styles from "./MyNotificationSettings.module.css";

const DEADLINE_OPTIONS: {
  label: string;
  value: DeadlineNotificationOffset;
}[] = [
  { label: "3일 전", value: 3 },
  { label: "1일 전", value: 1 },
  { label: "마감 당일", value: 0 },
];

export function MyNotificationSettingsPage() {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [deadlineEnabled, setDeadlineEnabled] = useState(true);
  const [deadlineOffsets, setDeadlineOffsets] =
    useState<DeadlineNotificationOffset[]>([1]);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      const userResponse = await getCurrentUser().catch(() => null);
      if (!alive) return;

      if (!userResponse?.authenticated || !userResponse.user) {
        setIsLoading(false);
        return;
      }

      setUser(userResponse.user);

      const [settingsResponse, homeResponse] = await Promise.all([
        getMyNotificationSettings().catch((error) => {
          window.alert(
            error instanceof Error
              ? error.message
              : "알림 설정을 불러오지 못했습니다.",
          );
          return null;
        }),
        getHomeJobs().catch(() => null),
      ]);

      if (!alive) return;

      if (settingsResponse?.settings) {
        const settings = settingsResponse.settings;
        setDeadlineEnabled(settings.deadlineEnabled);
        setDeadlineOffsets(settings.deadlineOffsets.length ? settings.deadlineOffsets : [1]);
        setMarketingAgreed(settings.marketingAgreed);
      }

      setBookmarkCount(homeResponse?.bookmarkCount ?? 0);
      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      alive = false;
    };
  }, []);

  const saveSettings = async (
    overrides: Partial<NotificationSettingsPayloadDto> = {},
    successMessage = "알림 설정이 저장되었습니다.",
  ) => {
    if (isSaving) return false;

    const payload: NotificationSettingsPayloadDto = {
      deadlineEnabled,
      deadlineOffsets,
      marketingAgreed,
      ...overrides,
    };

    setIsSaving(true);
    try {
      const response = await updateMyNotificationSettings(payload);
      const settings = response.settings;
      setDeadlineEnabled(settings.deadlineEnabled);
      setDeadlineOffsets(settings.deadlineOffsets.length ? settings.deadlineOffsets : [1]);
      setMarketingAgreed(settings.marketingAgreed);
      window.alert(successMessage);
      return true;
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "알림 설정 저장에 실패했습니다.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDeadlineOffset = (value: DeadlineNotificationOffset) => {
    setDeadlineOffsets((current) => {
      if (current.includes(value)) {
        const next = current.filter((item) => item !== value);
        return next.length ? next : current;
      }

      return [...current, value].sort((a, b) => b - a) as DeadlineNotificationOffset[];
    });
  };

  if (isLoading) {
    return null;
  }

  if (!user) return <MyUserLoadError title="알림 설정" />;

  return (
    <div className={styles.page}>
      <AppHeader user={user} bookmarkCount={bookmarkCount} />
      <main className={styles.frame}>
        <h1 className={styles.title}>알림 설정</h1>
        <p className={styles.subtitle}>
          중요한 전형 일정과 혜택 소식의 수신 여부를 설정할 수 있어요.
        </p>

        <section className={`${styles.section} ${styles.deadlineSection}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>접수 마감 임박 알림</h2>
              <p className={styles.sectionDescription}>
                마감 알림을 설정한 공고의 접수 마감 전에 알려드려요.
                <br />
                언제 알림을 받을까요? (중복 선택 가능)
              </p>
            </div>
            <ToggleSwitch
              checked={deadlineEnabled}
              label="접수 마감 임박 알림"
              onChange={() => setDeadlineEnabled((current) => !current)}
            />
          </div>

          <div className={styles.offsetGrid}>
            {DEADLINE_OPTIONS.map((option) => {
              const selected = deadlineOffsets.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.offsetButton} ${selected ? styles.offsetButtonSelected : ""}`}
                  disabled={!deadlineEnabled}
                  onClick={() => toggleDeadlineOffset(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.marketingSection}>
          <h2 className={styles.mutedTitle}>혜택·이벤트 알림 (광고성)</h2>
          <p className={styles.sectionDescription}>
            광고성 정보 수신 동의 상태를 변경할 수 있어요.
            <br />
            동의하지 않아도 서비스 이용에 지장이 없어요.
          </p>

          <div className={styles.marketingCard}>
            <div className={styles.marketingCardHeader}>
              <div>
                <strong>광고성 정보 수신 동의</strong>
                <p>댓글·답글 알림과 혜택·이벤트 소식을 받아요.</p>
              </div>
              <ToggleSwitch
                checked={marketingAgreed}
                label="광고성 정보 수신 동의"
                onChange={() => setMarketingAgreed((current) => !current)}
              />
            </div>
            <p className={styles.legalText}>
              동의 시 카카오 알림톡/친구톡 등으로 발송되며,
              <br />
              언제든 수신 거부할 수 있어요. 야간(21시~익일 8시)에는
              <br />
              발송되지 않아요.
            </p>
          </div>
        </section>

        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void saveSettings()}
          disabled={isSaving}
        >
          {isSaving ? "저장 중..." : "저장하기"}
        </button>
      </main>
      <AppFooter active="my" />
    </div>
  );
}

function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
