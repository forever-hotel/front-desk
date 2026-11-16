import type { AvailableRoomChangeOption } from '../models/available-room-change-option';
import type { RoomChangeResult } from '../models/room-change-result';

export interface ChangeRoomInput {
  bookingReference: string;
  targetRoomNumber: string;
  performedBy: string;
  reason?: string;
}

export abstract class RoomChangeRepository {
  abstract findAvailableRooms(
    bookingReference: string,
  ): Promise<AvailableRoomChangeOption[]>;

  abstract changeRoom(input: ChangeRoomInput): Promise<RoomChangeResult>;
}
