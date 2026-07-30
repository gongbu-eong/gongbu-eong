"use client";

import Link from "next/link";
import {
  AiIcon,
  CalendarIcon,
  CommunityIcon,
  HomeIcon,
  MenuIcon,
  MyIcon,
} from "@/features/home/components/HomeMain";
import styles from "./JobChrome.module.css";

export function JobHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span>공</span>부엉이
      </Link>
      <Link href="/" className={styles.menu} aria-label="메인 메뉴">
        <MenuIcon />
      </Link>
    </header>
  );
}

export function JobFooter() {
  return (
    <footer className={styles.footer}>
      <Link href="/"><HomeIcon /><span>홈</span></Link>
      <Link href="#"><CalendarIcon /><span>캘린더</span></Link>
      <Link href="/ai-tools/diagnosis" className={styles.active}>
        <AiIcon /><span>AI 도구</span>
      </Link>
      <Link href="#"><CommunityIcon /><span>커뮤니티</span></Link>
      <Link href="#"><MyIcon /><span>MY</span></Link>
    </footer>
  );
}
