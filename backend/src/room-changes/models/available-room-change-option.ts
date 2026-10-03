import { RoomStatus } from '../../rooms/models/room-status';

export interface AvailableRoomChangeOption {
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: number;
  status: RoomStatus.VACANT;
  lastClearedAt: string | null;
  updatedAt: string;
}
