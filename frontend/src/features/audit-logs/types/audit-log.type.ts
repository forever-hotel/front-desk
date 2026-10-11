export const AUDIT_EVENT_CATEGORIES = [
  "AUTHENTICATION",
  "FRONT_DESK_OPERATION",
  "PAYMENT",
  "STAFF_ACCOUNT_MANAGEMENT",
  "DATA_ACCESS",
  "TASK_SERVICE",
  "FOOD_ORDER",
] as const;

export type AuditEventCategory = (typeof AUDIT_EVENT_CATEGORIES)[number];

export interface AuditLogEntry {
  logId: string;
  eventCategory: string;
  actorType: string;
  staffUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListQuery {
  limit: number;
  offset: number;
  eventCategory?: AuditEventCategory;
  action?: string;
}
