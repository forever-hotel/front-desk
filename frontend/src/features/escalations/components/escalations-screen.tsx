"use client";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";
import { useEscalations } from "../hooks/use-escalations";
import styles from "./escalations-screen.module.css";

export function EscalationsScreen() {
  const { data, isPending, isError, refetch, isFetching } = useEscalations();
  const { connectionState } = useRealtimeStatus();
  const escalations = data ?? [];

  return (
    <section className={styles.page}>
      <div className={styles.headingRow}>
        <div>
          <h1>Escalations</h1>
          <p>Recent escalated worker tasks received by Front Desk.</p>
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

      {isError ? (
        <div className={styles.error} role="alert">
          Unable to load recent escalations. The count may be unavailable.
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Retrying..." : "Retry loading escalations"}
          </button>
        </div>
      ) : isPending ? (
        <div className={styles.emptyState} role="status">
          Loading escalations...
        </div>
      ) : escalations.length === 0 ? (
        <div className={styles.emptyState}>No recent escalations.</div>
      ) : (
        <>
          <p className={styles.countSummary} role="status" aria-live="polite">
            {new Set(escalations.map((event) => event.data.taskId)).size} recent
            escalated tasks
          </p>
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
                      event.data.priority === "HIGH"
                        ? styles.high
                        : styles.normal
                    }`}
                  >
                    {event.data.priority}
                  </span>
                </div>
                <div className={styles.meta}>
                  <span>Task: {event.data.taskId}</span>
                  <span>
                    Escalated:{" "}
                    {new Date(event.data.escalatedAt).toLocaleString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
