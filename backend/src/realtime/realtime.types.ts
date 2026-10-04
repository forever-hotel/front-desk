import type { TaskEscalatedEvent } from '../messaging/contracts/task-escalated.event';
import { RoomStatus } from '../rooms/models/room-status';
import {
  REALTIME_CONTRACT_VERSION,
  REALTIME_EVENTS,
} from './realtime.constants';

export type RoomStatusUpdateSource =
  'ROOM_STATUS' | 'CHECK_IN' | 'ROOM_CHANGE' | 'CHECK_OUT';

export interface RealtimeReadyEvent {
  eventType: typeof REALTIME_EVENTS.ready;
  contractVersion: typeof REALTIME_CONTRACT_VERSION;
  connectedAt: string;
}

export interface RoomStatusUpdatedEvent {
  eventId: string;
  eventType: typeof REALTIME_EVENTS.roomStatusUpdated;
  contractVersion: typeof REALTIME_CONTRACT_VERSION;
  occurredAt: string;
  data: {
    roomNumber: string;
    status: RoomStatus;
    source: RoomStatusUpdateSource;
    performedBy?: string;
  };
}

export interface PublishRoomStatusUpdateInput {
  roomNumber: string;
  status: RoomStatus;
  source: RoomStatusUpdateSource;
  performedBy?: string;
}

export type TaskEscalatedRealtimeEvent = TaskEscalatedEvent;
