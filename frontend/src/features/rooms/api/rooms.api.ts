import { apiClient } from "@/lib/api/api-client";

import type {
  RoomStatusBoardItem,
  RoomStatusTransitionResult,
  UpdateRoomStatusRequest,
} from "../types/room.type";

export function getRoomStatusBoard(): Promise<RoomStatusBoardItem[]> {
  return apiClient<RoomStatusBoardItem[]>("/rooms/status");
}

export function updateRoomStatus(
  roomNumber: string,
  payload: UpdateRoomStatusRequest,
): Promise<RoomStatusTransitionResult> {
  return apiClient<RoomStatusTransitionResult>(
    `/rooms/${encodeURIComponent(roomNumber)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
