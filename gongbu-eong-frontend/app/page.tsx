import Link from "next/link";
import { PageShell } from "./components/PageShell";

const menuCards = [
  {
    href: "/health",
    title: "Health",
    description: "Backend and database connection status.",
  },
  {
    href: "/study-items",
    title: "Study Items",
    description: "Study item API response from the backend.",
  },
  {
    href: "/test",
    title: "Test",
    description: "Read tno values from the PostgreSQL test table.",
  },
  {
    href: "/ai-tools/diagnosis",
    title: "Diagnosis",
    description: "Take a 10-question strength and tendency diagnosis.",
  },
];

export default function Home() {
  return (
    <PageShell
      title="gongbu-eong frontend"
      description="Select a menu to open each separated page."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {menuCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:bg-zinc-50"
          >
            <p className="text-lg font-semibold text-zinc-950">{card.title}</p>
            <p className="mt-2 text-sm text-zinc-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
