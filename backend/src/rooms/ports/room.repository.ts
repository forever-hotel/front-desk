import type { RoomStatusBoardItem } from '../models/room-status-board-item';
import type { RoomStatusTransitionPersistenceResult } from '../models/room-status-transition-persistence';
import type { RoomStatus } from '../models/room-status';

export interface TransitionRoomStatusInput {
  roomNumber: string;
  targetStatus: RoomStatus;
  allowedCurrentStatuses: readonly RoomStatus[];
}

export abstract class RoomRepository {
  abstract findAllStatuses(): Promise<RoomStatusBoardItem[]>;

  abstract transitionStatus(
    input: TransitionRoomStatusInput,
  ): Promise<RoomStatusTransitionPersistenceResult>;
}
