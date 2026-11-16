import { apiClient } from "@/lib/api/api-client";
import type { TaskEscalatedEvent } from "@/lib/realtime/realtime.type";

export function getRecentEscalations(): Promise<TaskEscalatedEvent[]> {
  return apiClient<TaskEscalatedEvent[]>("/realtime/escalations");
}
