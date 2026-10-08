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

export interface UpdateRoomStatusRequest {
  targetStatus: RoomStatus;
  notes?: string;
}

export interface RoomStatusTransitionResult {
  roomNumber: string;
  previousStatus: RoomStatus;
  status: RoomStatus;
  lastClearedAt: string | null;
  updatedAt: string;
}

export interface UpdateRoomStatusMutation {
  roomNumber: string;
  payload: UpdateRoomStatusRequest;
}
