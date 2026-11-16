"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import {
  getArrivalsForDate,
  getDeparturesForDate,
} from "../api/booking-schedule.api";

export function useArrivals(date: string) {
  return useQuery({
    queryKey: queryKeys.reservations.arrivals(date),
    queryFn: () => getArrivalsForDate(date),

    enabled: Boolean(date),

    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useDepartures(date: string) {
  return useQuery({
    queryKey: queryKeys.reservations.departures(date),
    queryFn: () => getDeparturesForDate(date),

    enabled: Boolean(date),

    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
