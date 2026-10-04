import type { TaskEscalatedEvent } from "@/types/realtime";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export async function getRecentEscalations(): Promise<TaskEscalatedEvent[]> {
  const url = new URL("/realtime/escalations", API_BASE_URL);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Escalation request failed with status ${response.status}`);
  }

  return (await response.json()) as TaskEscalatedEvent[];
}
