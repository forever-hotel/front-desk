import { apiClient } from "@/lib/api/api-client";

import type {
  AvailableRoomChangeOption,
  CreateRoomChangeRequest,
  RoomChangeResult,
} from "../types/room-change.type";

export function getAvailableRoomChanges(
  bookingReference: string,
): Promise<AvailableRoomChangeOption[]> {
  return apiClient<AvailableRoomChangeOption[]>(
    `/room-changes/${encodeURIComponent(bookingReference)}/available-rooms`,
  );
}

export function createRoomChange(
  payload: CreateRoomChangeRequest,
): Promise<RoomChangeResult> {
  return apiClient<RoomChangeResult>("/room-changes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
