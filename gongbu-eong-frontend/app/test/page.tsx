import { PageShell } from "../components/PageShell";
import { TestTnoList } from "@/features/test/components/TestTnoList";

export default function TestPage() {
  return (
    <PageShell
      title="Test"
      description="Display tno values queried from the PostgreSQL test table."
    >
      <TestTnoList />
    </PageShell>
  );
}
