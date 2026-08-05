import { CalendarMain } from "@/features/calendar/components/CalendarMain";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;

  const initialScope = params.view === "mine" ? "mine" : "all";

  return <CalendarMain key={initialScope} initialScope={initialScope} />;
}
