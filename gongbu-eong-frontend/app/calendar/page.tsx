import type { Metadata } from "next";
import { CalendarMain } from "@/features/calendar/components/CalendarMain";
import { getCalendarJobPostingsForServer } from "@/features/calendar/calendar.server";
import { canonicalUrl, SITE_NAME } from "@/shared/seo";

export const metadata: Metadata = {
  title: "채용 캘린더 | 공부엉이",
  description:
    "공기업 채용공고의 접수 시작일과 마감일을 캘린더와 리스트로 확인해 보세요.",
  alternates: {
    canonical: canonicalUrl("/calendar"),
  },
  openGraph: {
    title: "채용 캘린더 | 공부엉이",
    description:
      "공기업 채용 일정, 접수 시작 공고, 마감 공고를 공부엉이 채용 캘린더에서 확인하세요.",
    url: canonicalUrl("/calendar"),
    siteName: SITE_NAME,
    type: "website",
  },
};

export default async function CalendarPage() {
  const initialCalendar = await getCalendarJobPostingsForServer();

  return (
    <CalendarMain
      initialMonthKey={initialCalendar.monthKey}
      initialMonthJobs={initialCalendar.items}
    />
  );
}
