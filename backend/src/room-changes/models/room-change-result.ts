import { RoomStatus } from '../../rooms/models/room-status';

export interface RoomChangeResult {
  status: 'room_changed';
  bookingReference: string;
  previousRoomNumber: string;
  roomNumber: string;
  previousRoomStatus: RoomStatus.REQUIRES_CLEANING;
  roomStatus: RoomStatus.OCCUPIED;
  auditLogId: string;
}
