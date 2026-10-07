"use client";

import { useMemo } from "react";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";

import type { RoomStatus } from "@/types/room-status.type";

import { useRoomStatus } from "../hooks/use-room-status";

import styles from "./room-status-screen.module.css";

const STATUS_LABELS: Record<RoomStatus, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  REQUIRES_CLEANING: "Requires Cleaning",
  UNDER_MAINTENANCE: "Under Maintenance",
};

export function RoomStatusScreen() {
  const { data: rooms = [], isLoading, error } = useRoomStatus();

  const { connectionState } = useRealtimeStatus();

  const roomCounts = useMemo(() => {
    return rooms.reduce<Record<RoomStatus, number>>(
      (counts, room) => {
        counts[room.status] += 1;

        return counts;
      },
      {
        VACANT: 0,
        OCCUPIED: 0,
        REQUIRES_CLEANING: 0,
        UNDER_MAINTENANCE: 0,
      },
    );
  }, [rooms]);

  return (
    <section className={styles.page}>
      <div className={styles.headingRow}>
        <div>
          <h1>Room Status Board</h1>

          <p>Live room-state updates from Front Desk operations.</p>
        </div>

        <div
          className={`${styles.connectionBadge} ${styles[connectionState]}`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.connectionDot} aria-hidden="true" />

          {connectionState === "connected"
            ? "LIVE"
            : connectionState === "connecting"
              ? "RECONNECTING"
              : "REST FALLBACK"}
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>Vacant</span>
          <strong>{roomCounts.VACANT}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span>Occupied</span>
          <strong>{roomCounts.OCCUPIED}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span>Cleaning</span>
          <strong>{roomCounts.REQUIRES_CLEANING}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span>Maintenance</span>
          <strong>{roomCounts.UNDER_MAINTENANCE}</strong>
        </article>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          Unable to load the room-status board.
        </div>
      )}

      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.emptyState} role="status">
            Loading room status...
          </div>
        ) : rooms.length === 0 ? (
          <div className={styles.emptyState}>No rooms were returned.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Floor</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>

              <tbody>
                {rooms.map((room) => (
                  <tr key={room.roomNumber}>
                    <td className={styles.roomNumber}>{room.roomNumber}</td>

                    <td>{room.roomTypeName}</td>

                    <td>{room.floor}</td>

                    <td>
                      <span
                        className={`${styles.status} ${
                          styles[room.status.toLowerCase()]
                        }`}
                      >
                        {STATUS_LABELS[room.status]}
                      </span>
                    </td>

                    <td>{new Date(room.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
