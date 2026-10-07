import { apiClient } from "@/lib/api/api-client";

import type { RoomStatusBoardItem } from "../types/room.type";

export function getRoomStatusBoard(): Promise<RoomStatusBoardItem[]> {
  return apiClient<RoomStatusBoardItem[]>("/rooms/status");
}
