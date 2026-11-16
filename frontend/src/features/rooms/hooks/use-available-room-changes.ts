"use client";

import { useQuery } from "@tanstack/react-query";

import { getAvailableRoomChanges } from "../api/room-changes.api";

export function useAvailableRoomChanges(bookingReference: string | null) {
  return useQuery({
    queryKey: ["room-changes", "available", bookingReference],

    queryFn: () => getAvailableRoomChanges(bookingReference as string),

    enabled: Boolean(bookingReference),

    staleTime: 15_000,
  });
}
