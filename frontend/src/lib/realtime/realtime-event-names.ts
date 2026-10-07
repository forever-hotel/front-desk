export const REALTIME_NAMESPACE = "/realtime";

export const REALTIME_EVENTS = {
  ready: "realtime.ready",
  roomStatusUpdated: "room.status.updated",
  taskEscalated: "task.escalated",
} as const;

export const REALTIME_FALLBACK_POLL_INTERVAL_MS = 5000;
