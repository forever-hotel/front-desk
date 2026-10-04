export const REALTIME_NAMESPACE = '/realtime';

export const REALTIME_CONTRACT_VERSION = 1;

export const REALTIME_EVENTS = {
  ready: 'realtime.ready',
  roomStatusUpdated: 'room.status.updated',
  taskEscalated: 'task.escalated',
} as const;
