import { apiClient } from "@/lib/api/api-client";

import type { RunningFolio } from "../types/folio.type";

export function getRunningFolio(
  bookingReference: string,
): Promise<RunningFolio> {
  return apiClient<RunningFolio>(
    `/folios/${encodeURIComponent(bookingReference)}`,
  );
}
