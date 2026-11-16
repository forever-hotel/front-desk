import type { AuditLogEntry, AuditLogQuery } from '../models/audit-log-entry';

export abstract class AuditLogRepository {
  abstract findMany(query: AuditLogQuery): Promise<AuditLogEntry[]>;

  abstract findById(logId: string): Promise<AuditLogEntry | null>;
}
