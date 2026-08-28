"use client";

import Image from "next/image";
import Link from "next/link";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { BusinessInfo } from "@/features/layout/components/BusinessInfo";
import styles from "./MyPolicies.module.css";

const policyItems = [
  {
    href: "/my/policies/terms",
    iconSrc: "/my/policies/terms.png",
    iconWidth: 26,
    iconHeight: 26,
    title: "서비스 이용약관",
    description: "서비스 이용 조건과 회원의 권리·의무",
    required: true,
  },
  {
    href: "/my/policies/privacy",
    iconSrc: "/my/policies/privacy.png",
    iconWidth: 25,
    iconHeight: 30,
    title: "개인정보 처리방침",
    description: "수집 항목·이용 목적·보관 기간 안내",
    required: true,
  },
  {
    href: "/my/policies/marketing",
    iconSrc: "/my/policies/marketing.png",
    iconWidth: 27,
    iconHeight: 26,
    title: "마케팅 정보 수신 동의",
    description: "광고성 정보(알림톡·이메일) 수신 안내",
  },
];

export function MyPoliciesPage() {
  return (
    <div className={styles.page}>
      <AppHeader />
      <main className={styles.frame}>
        <h1 className={styles.title}>약관 및 정책</h1>
        <p className={styles.subtitle}>서비스 이용에 적용되는 약관과 정책을 확인할 수 있어요.</p>

        <nav className={styles.policyList} aria-label="약관 및 정책">
          {policyItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.policyItem}
            >
              <span className={styles.policyIcon} aria-hidden="true">
                <Image src={item.iconSrc} alt="" width={item.iconWidth} height={item.iconHeight} />
              </span>
              <span className={styles.policyText}>
                <span className={styles.policyTitleRow}>
                  <strong>{item.title}</strong>
                  {item.required ? <b>필수</b> : null}
                </span>
                <span className={styles.policyDescription}>{item.description}</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                &gt;
              </span>
            </Link>
          ))}
        </nav>
        <BusinessInfo className={styles.policyBusinessInfo} />
      </main>
      <AppFooter active="my" />
    </div>
  );
}
