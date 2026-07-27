"use client";

import { useEffect, useState } from "react";
import { getStudyItems } from "../study-items.api";
import { StudyItemDto } from "../study-item.dto";

type StudyItemsState =
  | { status: "loading" }
  | { status: "success"; items: StudyItemDto[] }
  | { status: "error"; message: string };

export function StudyItemsGrid() {
  const [state, setState] = useState<StudyItemsState>({ status: "loading" });

  useEffect(() => {
    async function loadStudyItems() {
      try {
        const response = await getStudyItems();
        setState({ status: "success", items: response.items });
      } catch (error) {
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Study items failed.",
        });
      }
    }

    loadStudyItems();
  }, []);

  if (state.status === "loading") {
    return <p className="text-sm text-zinc-500">Loading study items...</p>;
  }

  if (state.status === "error") {
    return <p className="text-sm text-red-700">{state.message}</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {state.items.map((item) => (
        <li key={item.id} className="rounded border border-zinc-200 bg-white p-4">
          <p className="font-medium text-zinc-950">{item.title}</p>
          <p className="mt-1 text-sm text-zinc-500">{item.status}</p>
        </li>
      ))}
    </ul>
  );
}
