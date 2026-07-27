import { PageShell } from "../components/PageShell";
import { StudyItemsGrid } from "@/features/study-items/components/StudyItemsGrid";

export default function StudyItemsPage() {
  return (
    <PageShell
      title="Study Items"
      description="Display study item data returned from the backend API."
    >
      <StudyItemsGrid />
    </PageShell>
  );
}
