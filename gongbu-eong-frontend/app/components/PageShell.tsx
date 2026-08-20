import { ReactNode } from "react";
import { AppNav } from "./AppNav";

type PageShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <AppNav />
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-zinc-600">{description}</p>
          ) : null}
        </header>
        {children}
      </section>
    </main>
  );
}
