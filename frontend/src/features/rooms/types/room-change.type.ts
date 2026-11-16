import type { RoomStatus } from "@/types/room-status.type";

export interface AvailableRoomChangeOption {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: Extract<RoomStatus, "VACANT">;
  lastClearedAt: string | null;
  updatedAt: string;
}

export interface CreateRoomChangeRequest {
  bookingReference: string;
  targetRoomNumber: string;
  performedBy: string;
  reason?: string;
}

export interface RoomChangeResult {
  status: "room_changed";
  bookingReference: string;
  previousRoomNumber: string;
  roomNumber: string;
  previousRoomStatus: Extract<RoomStatus, "REQUIRES_CLEANING">;
  roomStatus: Extract<RoomStatus, "OCCUPIED">;
  auditLogId: string;
}
