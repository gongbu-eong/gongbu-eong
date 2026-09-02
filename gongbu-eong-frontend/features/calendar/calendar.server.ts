import type { JobPostingCalendarResponseDto } from "@/features/home/home.dto";
import { fetchBackendJson } from "@/shared/server-data";

export function getCurrentCalendarMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    monthKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(
      2,
      "0",
    )}`,
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
}

export async function getCalendarJobPostingsForServer() {
  const range = getCurrentCalendarMonthRange();
  const params = new URLSearchParams({
    startDate: range.startDate,
    endDate: range.endDate,
    view: "all",
  });

  const response = await fetchBackendJson<JobPostingCalendarResponseDto>(
    `/api/jobs/calendar?${params.toString()}`,
  ).catch(
    () =>
      ({
        items: [],
        total: 0,
        startDate: range.startDate,
        endDate: range.endDate,
      }) satisfies JobPostingCalendarResponseDto,
  );

  return {
    monthKey: range.monthKey,
    items: response.items,
  };
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
