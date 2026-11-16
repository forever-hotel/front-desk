import { apiClient } from "@/lib/api/api-client";

import type { BookingSearchItem } from "../types/reservation.type";

export function getArrivalsForDate(date: string): Promise<BookingSearchItem[]> {
  const params = new URLSearchParams({ date });

  return apiClient<BookingSearchItem[]>(
    `/bookings/arrivals?${params.toString()}`,
  );
}

export function getDeparturesForDate(
  date: string,
): Promise<BookingSearchItem[]> {
  const params = new URLSearchParams({ date });

  return apiClient<BookingSearchItem[]>(
    `/bookings/departures?${params.toString()}`,
  );
}
