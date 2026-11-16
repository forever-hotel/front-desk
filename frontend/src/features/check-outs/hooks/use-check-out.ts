"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { checkOutGuest } from "../api/check-outs.api";

export function useCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkOutGuest,

    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.reservations.all,
        }),

        queryClient.invalidateQueries({
          queryKey: queryKeys.rooms.status,
        }),

        queryClient.invalidateQueries({
          queryKey: queryKeys.folios.all,
        }),
      ]);

      queryClient.removeQueries({
        queryKey: queryKeys.folios.running(result.bookingReference),
      });
    },
  });
}
