"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  trackProductEvent,
  trackProductEventBeforeNavigation,
} from "@/features/analytics/analytics.api";
import { getActiveBanners } from "../banner.api";
import type { ActiveBannerDto, BannerPlacement } from "../banner.dto";
import styles from "./CoachingBannerSlot.module.css";

type ManagedBannerSlotProps = {
  placement: BannerPlacement;
  showEmpty?: boolean;
};

export function ManagedBannerSlot({
  placement,
  showEmpty = false,
}: ManagedBannerSlotProps) {
  const router = useRouter();
  const [banner, setBanner] = useState<ActiveBannerDto | null>(null);
  const impressionIdRef = useRef("");

  useEffect(() => {
    let active = true;

    void getActiveBanners(placement)
      .then(({ items }) => {
        if (active) setBanner(items[0] || null);
      })
      .catch(() => {
        if (active) setBanner(null);
      });

    return () => {
      active = false;
    };
  }, [placement]);

  useEffect(() => {
    if (!banner || impressionIdRef.current === banner.id) return;
    impressionIdRef.current = banner.id;
    void trackProductEvent({
      eventType: "banner_impression",
      properties: {
        banner_id: banner.id,
        banner_key: `site_banner_${banner.id}`,
        banner_name: banner.name,
        banner_kind: "managed",
        placement,
        banner_placement: placement,
        target_path: banner.targetUrl,
      },
    });
  }, [banner, placement]);

  if (!banner && !showEmpty) return null;

  if (!banner) {
    return <div className={`${styles.banner} ${styles.emptyBanner}`} aria-hidden="true" />;
  }

  const image = (
    <picture className={styles.picture}>
      {banner.mobileImageUrl ? (
        <source media="(max-width: 599px)" srcSet={banner.mobileImageUrl} />
      ) : null}
      <Image
        src={banner.imageUrl}
        alt={banner.name}
        width={1800}
        height={342}
        sizes="(max-width: 599px) calc(100vw - 32px), 568px"
        className={styles.image}
        unoptimized
      />
    </picture>
  );
  const trackClick = () =>
    trackProductEventBeforeNavigation({
      eventType: "banner_click",
      properties: {
        banner_id: banner.id,
        banner_key: `site_banner_${banner.id}`,
        banner_name: banner.name,
        banner_kind: "managed",
        placement,
        banner_placement: placement,
        target_path: banner.targetUrl,
      },
    });

  const onClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      void trackClick();
      return;
    }

    event.preventDefault();
    await trackClick();

    if (/^https?:\/\//i.test(banner.targetUrl)) {
      window.location.assign(banner.targetUrl);
      return;
    }

    router.push(banner.targetUrl);
  };

  if (!banner.targetUrl) {
    return <div className={styles.banner}>{image}</div>;
  }

  if (/^https?:\/\//i.test(banner.targetUrl)) {
    return (
      <a className={styles.banner} href={banner.targetUrl} onClick={onClick}>
        {image}
      </a>
    );
  }

  return (
    <Link className={styles.banner} href={banner.targetUrl} onClick={onClick}>
      {image}
    </Link>
  );
}

export function CoachingBannerSlot({
  placement,
}: {
  placement: Extract<BannerPlacement, "resume_coaching" | "interview_coaching">;
}) {
  return <ManagedBannerSlot placement={placement} showEmpty />;
}
