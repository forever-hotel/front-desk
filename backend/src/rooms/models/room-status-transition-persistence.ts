import { RoomStatus } from './room-status';
import { RoomStatusTransitionResult } from './room-status-transition-result';

export type RoomStatusTransitionPersistenceResult =
  | {
      kind: 'updated';
      value: RoomStatusTransitionResult;
    }
  | {
      kind: 'not_found';
    }
  | {
      kind: 'same_state';
      currentStatus: RoomStatus;
    }
  | {
      kind: 'blocked';
      currentStatus: RoomStatus;
    };
