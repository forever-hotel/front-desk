"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { getRunningFolio } from "../api/folios.api";

export function useRunningFolio(bookingReference: string | null) {
  return useQuery({
    queryKey: bookingReference
      ? queryKeys.folios.running(bookingReference)
      : queryKeys.folios.all,

    queryFn: () => getRunningFolio(bookingReference as string),

    enabled: Boolean(bookingReference),

    staleTime: 15_000,
  });
}
