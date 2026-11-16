"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { getRecentBookings } from "../api/reservations.api";

export function useRecentBookings(limit = 5) {
  return useQuery({
    queryKey: queryKeys.reservations.recent(limit),
    queryFn: () => getRecentBookings(limit),
  });
}
