"use client";

import { useEffect, useState } from "react";
import { getTestRows } from "../test.api";
import { TestRowDto } from "../test.dto";

type TestRowsState =
  | { status: "loading" }
  | { status: "success"; rows: TestRowDto[] }
  | { status: "error"; message: string };

export function TestTnoList() {
  const [state, setState] = useState<TestRowsState>({ status: "loading" });

  useEffect(() => {
    async function loadTestRows() {
      try {
        const response = await getTestRows();
        setState({ status: "success", rows: response.items });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Test rows failed.",
        });
      }
    }

    loadTestRows();
  }, []);

  return (
    <section className="rounded border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-950">test.tno</h2>
        {state.status === "success" ? (
          <span className="text-sm text-zinc-500">{state.rows.length} rows</span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className="mt-4 text-sm text-zinc-500">Loading test rows...</p>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-4 text-sm text-red-700">{state.message}</p>
      ) : null}

      {state.status === "success" && state.rows.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-4">
          {state.rows.map((row, index) => (
            <li
              key={`${row.tno ?? "null"}-${index}`}
              className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-900"
            >
              {row.tno ?? "NULL"}
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === "success" && state.rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No rows found in the test table.
        </p>
      ) : null}
    </section>
  );
}
