import { RoomStatus } from './room-status';

export interface RoomStatusTransitionResult {
  roomNumber: string;
  previousStatus: RoomStatus;
  status: RoomStatus;
  lastClearedAt: string | null;
  updatedAt: string;
}
