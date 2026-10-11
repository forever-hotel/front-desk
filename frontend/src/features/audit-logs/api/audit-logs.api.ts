import { apiClient } from "@/lib/api/api-client";

import type { AuditLogEntry, AuditLogListQuery } from "../types/audit-log.type";

export function getAuditLogs(
  query: AuditLogListQuery,
): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  });

  if (query.eventCategory) {
    params.set("eventCategory", query.eventCategory);
  }

  if (query.action) {
    params.set("action", query.action.trim().toUpperCase());
  }

  return apiClient<AuditLogEntry[]>(`/audit-logs?${params.toString()}`);
}

export function getAuditLogById(logId: string): Promise<AuditLogEntry> {
  return apiClient<AuditLogEntry>(`/audit-logs/${encodeURIComponent(logId)}`);
}
