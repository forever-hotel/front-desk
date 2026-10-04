import type { RoomStatus } from "./room";

export type RealtimeConnectionState = "connecting" | "connected" | "fallback";

export type RoomStatusUpdateSource =
  "ROOM_STATUS" | "CHECK_IN" | "ROOM_CHANGE" | "CHECK_OUT";

export interface RealtimeReadyEvent {
  eventType: "realtime.ready";
  contractVersion: 1;
  connectedAt: string;
}

export interface RoomStatusUpdatedEvent {
  eventId: string;
  eventType: "room.status.updated";
  contractVersion: 1;
  occurredAt: string;
  data: {
    roomNumber: string;
    status: RoomStatus;
    source: RoomStatusUpdateSource;
    performedBy?: string;
  };
}

export type TaskEscalationCategory =
  | "ROOM_CLEANING"
  | "EXTRA_TOWELS"
  | "WATER_BOTTLES"
  | "MAINTENANCE"
  | "LAUNDRY"
  | "FOOD_DELIVERY"
  | "OTHER";

export type TaskEscalationPriority = "HIGH" | "NORMAL";

export interface TaskEscalatedEvent {
  eventId: string;
  eventType: "task.escalated";
  eventVersion: 1;
  occurredAt: string;
  source: "worker-management";
  data: {
    taskId: string;
    taskCategory: TaskEscalationCategory;
    roomNumber: string;
    priority: TaskEscalationPriority;
    escalatedAt: string;
  };
}
