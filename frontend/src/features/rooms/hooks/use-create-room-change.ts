"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { createRoomChange } from "../api/room-changes.api";

export function useCreateRoomChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRoomChange,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.rooms.status,
      });
    },
  });
}
