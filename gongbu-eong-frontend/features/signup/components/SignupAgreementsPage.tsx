"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUser } from "@/features/home/home.api";
import {
  policyDocuments,
  type PolicyDocumentKey,
  type PolicySection,
  type PolicyTable,
  type PolicyTextBlock,
} from "@/features/my/components/MyPolicyDocumentPage";
import { completeSignupAgreements } from "../signup.api";
import styles from "./SignupAgreementsPage.module.css";

type AgreementKey = "age" | "terms" | "privacy" | "marketing";

const agreementLabels = {
  age: "[필수] 만 14세 이상입니다.",
  terms: "[필수] 서비스 이용약관 동의",
  privacy: "[필수] 개인정보 수집·이용 동의",
  marketing: "[선택] 광고성 정보 수신 동의",
} as const;

export function SignupAgreementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checked, setChecked] = useState<Record<AgreementKey, boolean>>({
    age: true,
    terms: false,
    privacy: false,
    marketing: false,
  });
  const [openDocument, setOpenDocument] = useState<PolicyDocumentKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requiredAgreed = checked.age && checked.terms && checked.privacy;
  const allAgreed = requiredAgreed && checked.marketing;

  const nextPath = useMemo(() => {
    const rawNext = searchParams.get("next");
    return normalizeNextPath(rawNext);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;

    getCurrentUser()
      .then((response) => {
        if (!alive) return;
        if (!response.authenticated) {
          router.replace("/login");
          return;
        }
        if (response.user?.status === "active" && response.user.signupCompletedAt) {
          navigateToNext(nextPath, (href) => router.replace(href));
        }
      })
      .catch(() => {
        if (alive) router.replace("/login");
      });

    return () => {
      alive = false;
    };
  }, [nextPath, router]);

  const toggleAgreement = (key: AgreementKey) => {
    setChecked((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleAll = () => {
    const next = !allAgreed;
    setChecked({
      age: next,
      terms: next,
      privacy: next,
      marketing: next,
    });
  };

  const markDocumentConfirmed = (documentKey: PolicyDocumentKey) => {
    setOpenDocument(null);
    if (documentKey === "terms") {
      setChecked((current) => ({ ...current, terms: true }));
    } else if (documentKey === "privacy") {
      setChecked((current) => ({ ...current, privacy: true }));
    } else {
      setChecked((current) => ({ ...current, marketing: true }));
    }
  };

  const handleSubmit = async () => {
    if (!requiredAgreed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await completeSignupAgreements({
        ageOver14Agreed: checked.age,
        serviceTermsAgreed: checked.terms,
        privacyCollectionAgreed: checked.privacy,
        marketingAgreed: checked.marketing,
      });
      const redirectUrl = new URL(nextPath, window.location.origin);

      if (response.welcomeCreditsGranted) {
        redirectUrl.searchParams.set("ticketReward", "welcome");
        redirectUrl.searchParams.set("ticketAmount", "5");
      }

      navigateToNext(
        isExternalUrl(nextPath)
          ? redirectUrl.toString()
          : `${redirectUrl.pathname}${redirectUrl.search}`,
        (href) => router.replace(href),
      );
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "약관 동의 저장에 실패했습니다.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.frame} aria-labelledby="signup-agreement-title">
        <Image
          className={styles.owl}
          src="/signup/agreement-owl.png"
          alt=""
          width={112}
          height={126}
          priority
        />
        <div className={styles.titleGroup}>
          <h1 id="signup-agreement-title">공부엉이</h1>
          <p>서비스 이용을 위해 약관에 동의해 주세요.</p>
        </div>

        <button
          type="button"
          className={styles.allAgreement}
          onClick={toggleAll}
          aria-pressed={allAgreed}
        >
          <CheckCircle checked={allAgreed} />
          <span>
            <strong>전체 동의</strong>
            <small>필수·선택 항목에 모두 동의합니다.</small>
          </span>
        </button>

        <div className={styles.agreementList}>
          <AgreementRow
            checked={checked.age}
            label={agreementLabels.age}
            required
            onToggle={() => toggleAgreement("age")}
          />
          <AgreementRow
            checked={checked.terms}
            label={agreementLabels.terms}
            required
            documentKey="terms"
            onToggle={() => toggleAgreement("terms")}
            onOpen={() => setOpenDocument("terms")}
          />
          <AgreementRow
            checked={checked.privacy}
            label={agreementLabels.privacy}
            required
            documentKey="privacy"
            onToggle={() => toggleAgreement("privacy")}
            onOpen={() => setOpenDocument("privacy")}
          />
          <AgreementRow
            checked={checked.marketing}
            label={agreementLabels.marketing}
            documentKey="marketing"
            description={
              <>
                이벤트·혜택 소식을 알림톡·이메일로 받아요.
                <br />
                동의하지 않아도 가입할 수 있어요.
              </>
            }
            onToggle={() => toggleAgreement("marketing")}
            onOpen={() => setOpenDocument("marketing")}
          />
        </div>

        <button
          type="button"
          className={`${styles.submitButton} ${requiredAgreed ? styles.submitButtonActive : ""}`}
          disabled={!requiredAgreed || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? "저장 중..." : "동의하고 시작하기"}
        </button>

        <p className={styles.requiredGuide}>
          필수 항목에 동의해야 서비스를 이용할 수 있습니다.
        </p>
      </section>

      {openDocument ? (
        <PolicyDocumentModal
          documentKey={openDocument}
          onClose={() => setOpenDocument(null)}
          onConfirm={() => markDocumentConfirmed(openDocument)}
        />
      ) : null}
    </main>
  );
}

function normalizeNextPath(rawNext: string | null) {
  if (!rawNext) {
    return "/";
  }

  if (rawNext.startsWith("/")) {
    return rawNext;
  }

  try {
    const url = new URL(rawNext);
    const isEventResultPath =
      url.pathname === "/events/diagnosis" ||
      url.pathname === "/events/diagnosis/result";

    if (!isEventResultPath) {
      return "/";
    }

    const configuredEventUrl =
      process.env.NEXT_PUBLIC_EVENT_APP_URL ||
      process.env.NEXT_PUBLIC_EVENT_URL;
    const configuredEventOrigin = configuredEventUrl
      ? new URL(configuredEventUrl).origin
      : "";
    const currentOrigin =
      typeof window !== "undefined" ? window.location.origin : "";
    const isAllowedLocal =
      process.env.NODE_ENV !== "production" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (
      url.origin === configuredEventOrigin ||
      url.origin === currentOrigin ||
      isAllowedLocal
    ) {
      return url.toString();
    }
  } catch {
    return "/";
  }

  return "/";
}

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function navigateToNext(
  value: string,
  replace: (href: string) => void,
) {
  if (isExternalUrl(value)) {
    window.location.href = value;
    return;
  }

  replace(value);
}

function AgreementRow({
  checked,
  label,
  required = false,
  description,
  documentKey,
  onToggle,
  onOpen,
}: {
  checked: boolean;
  label: string;
  required?: boolean;
  description?: ReactNode;
  documentKey?: PolicyDocumentKey;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  return (
    <div className={`${styles.agreementRow} ${description ? styles.agreementRowTall : ""}`}>
      <button
        type="button"
        className={styles.checkButton}
        aria-label={label}
        aria-pressed={checked}
        onClick={onToggle}
      >
        <CheckCircle checked={checked} />
      </button>
      <div className={styles.agreementText}>
        <button type="button" className={styles.agreementLabel} onClick={onToggle}>
          <span className={required ? styles.requiredLabel : styles.optionalLabel}>
            {label.slice(0, 4)}
          </span>
          {label.slice(4)}
        </button>
        {description ? <p>{description}</p> : null}
      </div>
      {documentKey ? (
        <button type="button" className={styles.viewButton} onClick={onOpen}>
          보기
        </button>
      ) : null}
    </div>
  );
}

function CheckCircle({ checked }: { checked: boolean }) {
  return <span className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ""}`} />;
}

export function PolicyDocumentModal({
  documentKey,
  onClose,
  onConfirm,
}: {
  documentKey: PolicyDocumentKey;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [canConfirm, setCanConfirm] = useState(false);
  const document = policyDocuments[documentKey];

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const update = () => {
      setCanConfirm(body.scrollTop + body.clientHeight >= body.scrollHeight - 4);
    };

    update();
    body.addEventListener("scroll", update);
    return () => body.removeEventListener("scroll", update);
  }, [documentKey]);

  return (
    <div className={styles.modalOverlay} role="presentation">
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-document-title"
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label="닫기">
          ×
        </button>
        <div ref={bodyRef} className={styles.modalBody}>
          <h2 id="policy-document-title">{document.title}</h2>
          {document.sections.map((section, index) => (
            <PolicySectionView key={`${section.title}-${index}`} section={section} />
          ))}
        </div>
        <button
          type="button"
          className={`${styles.modalConfirm} ${canConfirm ? styles.modalConfirmActive : ""}`}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          확인
        </button>
      </section>
    </div>
  );
}

function PolicySectionView({ section }: { section: PolicySection }) {
  return (
    <section className={styles.policySection}>
      {section.title ? <h3>{section.title}</h3> : null}
      {section.blocks.map((block, index) => (
        <PolicyBlockView key={`${section.title}-${index}`} block={block} />
      ))}
    </section>
  );
}

function PolicyBlockView({ block }: { block: PolicyTextBlock | PolicyTable }) {
  if (block.kind === "paragraph" || block.kind === "final") {
    return <p className={block.kind === "final" ? styles.policyFinal : undefined}>{block.text}</p>;
  }

  if (block.kind === "ordered") {
    return (
      <ol start={block.start} className={styles.policyList}>
        {block.items?.map((item) => <li key={item}>{item}</li>)}
      </ol>
    );
  }

  if (block.kind === "unordered") {
    return (
      <ul className={styles.policyList}>
        {block.items?.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }

  if (block.kind === "table") {
    return (
      <table
        className={`${styles.policyTable} ${block.narrowFirstColumn ? styles.policyTableNarrow : ""} ${
          block.dangerFirstColumn ? styles.policyTableDanger : ""
        }`}
      >
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return null;
}
