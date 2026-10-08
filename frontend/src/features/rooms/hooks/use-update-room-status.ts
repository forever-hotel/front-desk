"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";

import { updateRoomStatus } from "../api/rooms.api";

import type {
  RoomStatusBoardItem,
  UpdateRoomStatusMutation,
} from "../types/room.type";

export function useUpdateRoomStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomNumber, payload }: UpdateRoomStatusMutation) =>
      updateRoomStatus(roomNumber, payload),

    onSuccess: (result) => {
      queryClient.setQueryData<RoomStatusBoardItem[]>(
        queryKeys.rooms.status,
        (currentRooms) => {
          if (!currentRooms) {
            return currentRooms;
          }

          return currentRooms.map((room) =>
            room.roomNumber === result.roomNumber
              ? {
                  ...room,
                  status: result.status,
                  lastClearedAt: result.lastClearedAt,
                  updatedAt: result.updatedAt,
                }
              : room,
          );
        },
      );
    },
  });
}
