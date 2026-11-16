import { Injectable, NotFoundException } from '@nestjs/common';
import { redactLogValue } from '../security/redaction/log-redactor';
import type { AuditLogEntry, AuditLogQuery } from './models/audit-log-entry';
import { AuditLogRepository } from './ports/audit-log.repository';

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async findMany(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    const rows = await this.auditLogRepository.findMany(query);

    return rows.map((row) => this.sanitize(row));
  }

  async findById(logId: string): Promise<AuditLogEntry> {
    const row = await this.auditLogRepository.findById(logId);

    if (!row) {
      throw new NotFoundException('Audit log entry not found');
    }

    return this.sanitize(row);
  }

  private sanitize(entry: AuditLogEntry): AuditLogEntry {
    return {
      ...entry,
      details:
        entry.details === null
          ? null
          : (redactLogValue(entry.details) as Record<string, unknown>),
    };
  }
}
