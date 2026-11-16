import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuditLogEntry, AuditLogQuery } from '../models/audit-log-entry';
import { AuditLogRepository } from '../ports/audit-log.repository';

interface AuditLogRow {
  logId: string;
  eventCategory: string;
  actorType: string;
  staffUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

@Injectable()
export class PostgresAuditLogRepository extends AuditLogRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findMany(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (query.eventCategory) {
      parameters.push(query.eventCategory);

      conditions.push(`event_category::text = $${parameters.length}`);
    }

    if (query.action) {
      parameters.push(query.action);

      conditions.push(`action = $${parameters.length}`);
    }

    parameters.push(query.limit);

    const limitParameter = parameters.length;

    parameters.push(query.offset);

    const offsetParameter = parameters.length;

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = (await this.dataSource.query(
      `
        SELECT
          log_id::text AS "logId",
          event_category::text
            AS "eventCategory",
          actor_type::text AS "actorType",
          staff_user_id::text
            AS "staffUserId",
          action,
          entity_type AS "entityType",
          entity_id AS "entityId",
          details,
          created_at AS "createdAt"
        FROM audit_logs
        ${whereClause}
        ORDER BY created_at DESC, log_id DESC
        LIMIT $${limitParameter}
        OFFSET $${offsetParameter}
      `,
      parameters,
    )) as AuditLogRow[];

    return rows.map((row) => this.mapRow(row));
  }

  async findById(logId: string): Promise<AuditLogEntry | null> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          log_id::text AS "logId",
          event_category::text
            AS "eventCategory",
          actor_type::text AS "actorType",
          staff_user_id::text
            AS "staffUserId",
          action,
          entity_type AS "entityType",
          entity_id AS "entityId",
          details,
          created_at AS "createdAt"
        FROM audit_logs
        WHERE log_id = $1
        LIMIT 1
      `,
      [logId],
    )) as AuditLogRow[];

    if (rows.length === 0) {
      return null;
    }

    return this.mapRow(rows[0]);
  }

  private mapRow(row: AuditLogRow): AuditLogEntry {
    return {
      logId: row.logId,
      eventCategory: row.eventCategory,
      actorType: row.actorType,
      staffUserId: row.staffUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      details: row.details,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    };
  }
}
