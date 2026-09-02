import type { AiToolEventsResponseDto } from "./ai-tools.dto";
import { fetchBackendJson } from "@/shared/server-data";

export async function getAiToolEventsForServer() {
  return fetchBackendJson<AiToolEventsResponseDto>("/api/events/public").catch(
    () => ({ ok: false, items: [] }),
  );
}
