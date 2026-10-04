"use client";

import { useCallback, useEffect, useState } from "react";
import { getRecentEscalations } from "@/services/escalations-api";
import { connectRealtime } from "@/services/realtime-client";
import type {
  RealtimeConnectionState,
  TaskEscalatedEvent,
} from "@/types/realtime";
import styles from "./escalations.module.css";

const FALLBACK_POLL_INTERVAL_MS = 5000;

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<TaskEscalatedEvent[]>([]);

  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("connecting");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const refreshEscalations = useCallback(async () => {
    try {
      const data = await getRecentEscalations();

      setEscalations(data);
      setError(null);
    } catch {
      setError("Unable to load recent escalations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getRecentEscalations()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setEscalations(data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setError("Unable to load recent escalations.");
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
        void refreshEscalations();
      },

      onTaskEscalated: (event) => {
        setEscalations((current) => {
          const withoutExistingTask = current.filter(
            (item) => item.data.taskId !== event.data.taskId,
          );

          return [event, ...withoutExistingTask].slice(0, 100);
        });
      },
    });
  }, [refreshEscalations]);

  useEffect(() => {
    if (connectionState === "connected") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshEscalations();
    }, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [connectionState, refreshEscalations]);

  return (
    <section className={styles.page}>
      <div className={styles.headingRow}>
        <div>
          <h1>Escalations</h1>

          <p>Live escalated worker tasks received from WKMS.</p>
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

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.emptyState}>Loading escalations...</div>
      ) : escalations.length === 0 ? (
        <div className={styles.emptyState}>No recent escalations.</div>
      ) : (
        <div className={styles.list}>
          {escalations.map((event) => (
            <article key={event.eventId} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.room}>
                    Room {event.data.roomNumber}
                  </span>

                  <h2>{event.data.taskCategory}</h2>
                </div>

                <span
                  className={`${styles.priority} ${
                    event.data.priority === "HIGH" ? styles.high : styles.normal
                  }`}
                >
                  {event.data.priority}
                </span>
              </div>

              <div className={styles.meta}>
                <span>Task: {event.data.taskId}</span>

                <span>
                  Escalated: {new Date(event.data.escalatedAt).toLocaleString()}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
