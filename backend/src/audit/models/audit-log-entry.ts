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

export interface AuditLogQuery {
  limit: number;
  offset: number;
  eventCategory?: string;
  action?: string;
}
