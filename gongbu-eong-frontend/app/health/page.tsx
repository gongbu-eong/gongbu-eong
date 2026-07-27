import { PageShell } from "../components/PageShell";
import { BackendHealthCard } from "@/features/health/components/BackendHealthCard";

export default function HealthPage() {
  return (
    <PageShell
      title="Health"
      description="Check whether the frontend can reach the backend and database."
    >
      <BackendHealthCard />
    </PageShell>
  );
}
