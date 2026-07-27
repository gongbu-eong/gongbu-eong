"use client";

import { useEffect, useState } from "react";
import { getBackendHealth } from "../health.api";
import { HealthResponseDto } from "../health.dto";

type HealthState =
  | { status: "loading" }
  | { status: "success"; data: HealthResponseDto }
  | { status: "error"; message: string };

export function BackendHealthCard() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    async function loadHealth() {
      try {
        setHealth({
          status: "success",
          data: await getBackendHealth(),
        });
      } catch (error) {
        setHealth({
          status: "error",
          message:
            error instanceof Error ? error.message : "Backend health failed.",
        });
      }
    }

    loadHealth();
  }, []);

  if (health.status === "loading") {
    return (
      <section className="rounded border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-500">Checking backend...</p>
      </section>
    );
  }

  if (health.status === "error") {
    return (
      <section className="rounded border border-red-200 bg-red-50 p-4 text-red-900">
        <p className="font-semibold">Backend connection failed</p>
        <p className="mt-1 text-sm">{health.message}</p>
      </section>
    );
  }

  return (
    <section className="rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <p className="text-sm font-semibold uppercase tracking-wide">Connected</p>
      <p className="mt-1 text-lg font-semibold">{health.data.service}</p>
      <p className="mt-1 text-sm">Last checked: {health.data.timestamp}</p>
      {health.data.database ? (
        <p className="mt-1 text-sm">
          Database: {health.data.database.connected ? "connected" : "offline"}
        </p>
      ) : null}
    </section>
  );
}
