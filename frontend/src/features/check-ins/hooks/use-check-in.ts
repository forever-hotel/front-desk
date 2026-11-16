"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { checkInGuest } from "../api/check-ins.api";

export function useCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkInGuest,

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.reservations.all,
        }),

        queryClient.invalidateQueries({
          queryKey: queryKeys.rooms.status,
        }),
      ]);
    },
  });
}
