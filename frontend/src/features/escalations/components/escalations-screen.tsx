"use client";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";

import { useEscalations } from "../hooks/use-escalations";

import styles from "./escalations-screen.module.css";

export function EscalationsScreen() {
  const { data: escalations = [], isLoading, error } = useEscalations();

  const { connectionState } = useRealtimeStatus();

  return (
    <section className={styles.page}>
      <div className={styles.headingRow}>
        <div>
          <h1>Escalations</h1>

          <p>Live escalated worker tasks received from WKMS.</p>
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

      {error && (
        <div className={styles.error} role="alert">
          Unable to load recent escalations.
        </div>
      )}

      {isLoading ? (
        <div className={styles.emptyState} role="status">
          Loading escalations...
        </div>
      ) : escalations.length === 0 ? (
        <div className={styles.emptyState}>No recent escalations.</div>
      ) : (
        <div className={styles.list} aria-live="polite">
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
                  role={event.data.priority === "HIGH" ? "alert" : undefined}
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
