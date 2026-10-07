import { apiClient } from "@/lib/api/api-client";

import type {
  BookingSearchItem,
  RecentBookingsResponse,
} from "../types/reservation.type";

export async function searchBookings(
  query: string,
): Promise<BookingSearchItem[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const params = new URLSearchParams({
    query: normalizedQuery,
  });

  return apiClient<BookingSearchItem[]>(
    `/bookings/search?${params.toString()}`,
  );
}

export async function getRecentBookings(
  limit = 5,
): Promise<BookingSearchItem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);

  const params = new URLSearchParams({
    limit: String(safeLimit),
  });

  const response = await apiClient<RecentBookingsResponse>(
    `/bookings/recent?${params.toString()}`,
  );

  return response.value;
}
