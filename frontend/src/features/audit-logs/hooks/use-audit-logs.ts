"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { getAuditLogs } from "../api/audit-logs.api";
import type { AuditLogListQuery } from "../types/audit-log.type";

export function useAuditLogs(query: AuditLogListQuery) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(query),
    queryFn: () => getAuditLogs(query),
    refetchOnWindowFocus: true,
  });
}
