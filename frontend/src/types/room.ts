export type RoomStatus =
  "VACANT" | "OCCUPIED" | "REQUIRES_CLEANING" | "UNDER_MAINTENANCE";

export interface RoomStatusBoardItem {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: RoomStatus;
  lastClearedAt: string | null;
  updatedAt: string;
}
