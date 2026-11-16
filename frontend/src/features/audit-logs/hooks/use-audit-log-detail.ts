"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { getAuditLogById } from "../api/audit-logs.api";

export function useAuditLogDetail(logId: string | null) {
  return useQuery({
    queryKey: queryKeys.auditLogs.detail(logId),
    queryFn: () => {
      if (!logId) {
        throw new Error("Select an audit log entry first");
      }

      return getAuditLogById(logId);
    },
    enabled: logId !== null,
  });
}
