"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { createWalkInBooking } from "../api/reservations.api";

export function useCreateWalkInBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWalkInBooking,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.reservations.all,
      });
    },
  });
}
