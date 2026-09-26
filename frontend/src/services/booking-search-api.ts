import type { BookingSearchItem, BookingSearchResponse } from "@/types/booking";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

function extractBookings(payload: BookingSearchResponse): BookingSearchItem[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.value)) {
    return payload.value;
  }

  throw new Error("Unexpected booking API response.");
}

export async function searchBookings(
  query: string,
): Promise<BookingSearchItem[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const url = new URL("/bookings/search", API_BASE_URL);

  url.searchParams.set("query", normalizedQuery);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Booking search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as BookingSearchResponse;

  return extractBookings(payload);
}

export async function getRecentBookings(
  limit = 5,
): Promise<BookingSearchItem[]> {
  const url = new URL("/bookings/recent", API_BASE_URL);

  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Recent bookings request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as BookingSearchResponse;

  return extractBookings(payload);
}
