import type { RoomStatusBoardItem } from "@/types/room";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export async function getRoomStatusBoard(): Promise<RoomStatusBoardItem[]> {
  const url = new URL("/rooms/status", API_BASE_URL);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Room-status request failed with status ${response.status}`,
    );
  }

  return (await response.json()) as RoomStatusBoardItem[];
}
