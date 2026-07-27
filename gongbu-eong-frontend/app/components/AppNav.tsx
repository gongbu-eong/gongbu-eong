import Link from "next/link";

const menuItems = [
  { href: "/", label: "Home" },
  { href: "/health", label: "Health" },
  { href: "/study-items", label: "Study Items" },
  { href: "/test", label: "Test" },
  { href: "/ai-tools/diagnosis", label: "Diagnosis" },
];

export function AppNav() {
  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
