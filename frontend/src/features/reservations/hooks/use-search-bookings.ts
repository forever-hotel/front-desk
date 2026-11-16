"use client";

import { useMutation } from "@tanstack/react-query";

import { searchBookings } from "../api/reservations.api";

export function useSearchBookings() {
  return useMutation({
    mutationFn: searchBookings,
  });
}
