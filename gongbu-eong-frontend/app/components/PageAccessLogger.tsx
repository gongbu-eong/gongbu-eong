"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logPageView } from "@/features/access/access.api";

type PageAccessLoggerProps = {
  title: string;
};

export function PageAccessLogger({ title }: PageAccessLoggerProps) {
  const pathname = usePathname();

  useEffect(() => {
    logPageView({ path: pathname, title });
  }, [pathname, title]);

  return null;
}
