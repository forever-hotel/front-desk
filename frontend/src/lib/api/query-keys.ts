import type { AuditLogListQuery } from "@/features/audit-logs/types/audit-log.type";

export const queryKeys = {
  reservations: {
    all: ["reservations"] as const,
    recent: (limit: number) => ["reservations", "recent", limit] as const,
    arrivals: (date: string) => ["reservations", "arrivals", date] as const,
    departures: (date: string) => ["reservations", "departures", date] as const,
  },
  rooms: {
    status: ["rooms", "status"] as const,
  },
  escalations: {
    recent: ["escalations", "recent"] as const,
  },
  folios: {
    all: ["folios"] as const,
    running: (bookingReference: string) =>
      ["folios", "running", bookingReference] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (query: AuditLogListQuery) => ["audit-logs", "list", query] as const,
    detail: (logId: string | null) => ["audit-logs", "detail", logId] as const,
  },
} as const;
