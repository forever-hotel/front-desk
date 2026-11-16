import { RoomStatus } from './room-status';

export interface RoomStatusBoardItem {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: RoomStatus;
  lastClearedAt: string | null;
  updatedAt: string;
}
