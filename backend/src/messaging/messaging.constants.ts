export const RABBITMQ_TOPOLOGY = {
  defaultExchange: 'forever.events',

  queues: {
    taskEscalation: 'fds.task-escalation.v1',
    taskEscalationRetry: 'fds.task-escalation.retry.v1',
    taskEscalationDeadLetter: 'fds.task-escalation.dlq.v1',
  },

  routingKeys: {
    checkoutCompleted: 'fds.checkout.completed.v1',
    taskEscalated: 'wkms.task.escalated.v1',
    taskEscalationRetry: 'fds.task-escalation.retry.v1',
    taskEscalationDeadLetter: 'fds.task-escalation.dlq.v1',
  },
} as const;

export const MESSAGE_EVENT_TYPES = {
  checkoutCompleted: 'checkout.completed',
  taskEscalated: 'task.escalated',
} as const;

export const MESSAGE_EVENT_VERSIONS = {
  checkoutCompleted: 1,
  taskEscalated: 1,
} as const;

export const MESSAGE_SOURCES = {
  frontDesk: 'front-desk',
  workerManagement: 'worker-management',
} as const;
