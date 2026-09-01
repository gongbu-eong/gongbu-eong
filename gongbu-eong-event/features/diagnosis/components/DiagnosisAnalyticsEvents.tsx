"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackProductEvent } from "@/features/analytics/analytics.api";

export function DiagnosisStartEvent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();

    trackProductEvent({
      eventType: "diagnosis_start",
      properties: {
        path: query ? `${pathname}?${query}` : pathname,
      },
    });
  }, [pathname, searchParams]);

  return null;
}

export function DiagnosisResultViewEvent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const resultId = searchParams.get("resultId");

    trackProductEvent({
      eventType: "diagnosis_result_view",
      diagnosisResultId: isUuid(resultId) ? resultId : null,
      properties: {
        path: query ? `${pathname}?${query}` : pathname,
      },
    });
  }, [pathname, searchParams]);

  return null;
}

function isUuid(value: string | null) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
