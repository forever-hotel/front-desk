import type { RoomStatus } from "@/types/room-status.type";

export interface RoomStatusBoardItem {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: RoomStatus;
  lastClearedAt: string | null;
  updatedAt: string;
}
