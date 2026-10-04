"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRoomStatusBoard } from "@/services/rooms-api";
import { connectRealtime } from "@/services/realtime-client";
import type { RealtimeConnectionState } from "@/types/realtime";
import type { RoomStatus, RoomStatusBoardItem } from "@/types/room";
import styles from "./rooms.module.css";

const FALLBACK_POLL_INTERVAL_MS = 5000;

const STATUS_LABELS: Record<RoomStatus, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  REQUIRES_CLEANING: "Requires Cleaning",
  UNDER_MAINTENANCE: "Under Maintenance",
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomStatusBoardItem[]>([]);

  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("connecting");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const refreshRoomStatus = useCallback(async () => {
    try {
      const data = await getRoomStatusBoard();

      setRooms(data);
      setError(null);
    } catch {
      setError("Unable to load the room-status board.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getRoomStatusBoard()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setRooms(data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setError("Unable to load the room-status board.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return connectRealtime({
      onConnectionState: setConnectionState,

      onResyncRequired: () => {
        void refreshRoomStatus();
      },

      onRoomStatusUpdated: (event) => {
        setRooms((currentRooms) =>
          currentRooms.map((room) =>
            room.roomNumber === event.data.roomNumber
              ? {
                  ...room,
                  status: event.data.status,
                  updatedAt: event.occurredAt,
                }
              : room,
          ),
        );
      },
    });
  }, [refreshRoomStatus]);

  useEffect(() => {
    if (connectionState === "connected") {
      return;
    }

    /*
     * Application-level fallback.
     *
     * If Socket.IO cannot maintain a realtime connection,
     * periodically refresh the authoritative REST snapshot.
     */
    const interval = window.setInterval(() => {
      void refreshRoomStatus();
    }, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [connectionState, refreshRoomStatus]);

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

        <div className={`${styles.connectionBadge} ${styles[connectionState]}`}>
          <span className={styles.connectionDot} />

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

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyState}>Loading room status...</div>
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
