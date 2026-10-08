"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alert, Button, Spin } from "antd";

import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  LogIn,
  LogOut,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import {
  useArrivals,
  useDepartures,
  type BookingSearchItem,
} from "@/features/reservations";

import { useRoomStatus, type RoomStatusBoardItem } from "@/features/rooms";

import { useEscalations } from "@/features/escalations";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";

import type { RoomStatus } from "@/types/room-status.type";

import styles from "./dashboard-screen.module.css";

const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  REQUIRES_CLEANING: "Needs Cleaning",
  UNDER_MAINTENANCE: "Maintenance",
};

const ROOM_STATUS_CLASSES: Record<RoomStatus, string> = {
  VACANT: styles.vacant,
  OCCUPIED: styles.occupied,
  REQUIRES_CLEANING: styles.cleaning,
  UNDER_MAINTENANCE: styles.maintenance,
};

function getLocalDate(): string {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DashboardScreen() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const updateDate = () => {
      setToday(getLocalDate());
    };

    const initialTimer = window.setTimeout(updateDate, 0);

    const interval = window.setInterval(updateDate, 60_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const arrivalsQuery = useArrivals(today ?? "");

  const departuresQuery = useDepartures(today ?? "");

  const roomsQuery = useRoomStatus();

  const escalationsQuery = useEscalations();

  const { connectionState } = useRealtimeStatus();

  const roomCounts = useMemo(() => {
    if (!roomsQuery.data) {
      return null;
    }

    return roomsQuery.data.reduce<Record<RoomStatus, number>>(
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
  }, [roomsQuery.data]);

  const previewRooms = useMemo(() => {
    return [...(roomsQuery.data ?? [])]
      .sort((left, right) => {
        if (left.floor !== right.floor) {
          return left.floor - right.floor;
        }

        return left.roomNumber.localeCompare(right.roomNumber, undefined, {
          numeric: true,
        });
      })
      .slice(0, 12);
  }, [roomsQuery.data]);

  const recentEscalations = useMemo(() => {
    return [...(escalationsQuery.data ?? [])]
      .sort((left, right) =>
        right.data.escalatedAt.localeCompare(left.data.escalatedAt),
      )
      .slice(0, 4);
  }, [escalationsQuery.data]);

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.titleRow}>
            <LayoutGrid size={19} aria-hidden="true" />

            <h1>Front Desk Dashboard</h1>
          </div>

          <p>Front Desk operations overview and live hotel room status</p>
        </div>

        <div className={styles.dateBadge}>
          <CalendarDays size={14} aria-hidden="true" />

          <span>{today ? formatDate(today) : "Loading date..."}</span>
        </div>
      </header>

      <div className={styles.metricsGrid}>
        <MetricCard
          label="Awaiting Check-In"
          value={arrivalsQuery.data?.length ?? null}
          loading={!today || arrivalsQuery.isLoading}
          icon={LogIn}
          description="Confirmed arrivals today"
          href="/check-in"
          tone="navy"
        />

        <MetricCard
          label="Due for Check-Out"
          value={departuresQuery.data?.length ?? null}
          loading={!today || departuresQuery.isLoading}
          icon={LogOut}
          description="Checked-in departures today"
          href="/check-out"
          tone="gold"
        />

        <MetricCard
          label="Occupied Rooms"
          value={roomCounts?.OCCUPIED ?? null}
          loading={roomsQuery.isLoading}
          icon={LayoutGrid}
          description="Currently occupied"
          href="/rooms"
          tone="success"
        />

        <MetricCard
          label="Needs Cleaning"
          value={roomCounts?.REQUIRES_CLEANING ?? null}
          loading={roomsQuery.isLoading}
          icon={ClipboardList}
          description="Rooms awaiting cleaning"
          href="/rooms"
          tone="warning"
        />
      </div>

      <div className={styles.scheduleGrid}>
        <BookingScheduleCard
          title="Today's Arrivals"
          subtitle="Confirmed bookings awaiting check-in"
          bookings={arrivalsQuery.data ?? []}
          loading={!today || arrivalsQuery.isLoading}
          error={arrivalsQuery.isError}
          dateField="checkInDate"
          emptyMessage="No confirmed arrivals awaiting check-in today."
          actionLabel="Open Check-In"
          actionHref="/check-in"
          onRetry={() => void arrivalsQuery.refetch()}
        />

        <BookingScheduleCard
          title="Today's Departures"
          subtitle="Checked-in guests due to depart"
          bookings={departuresQuery.data ?? []}
          loading={!today || departuresQuery.isLoading}
          error={departuresQuery.isError}
          dateField="checkOutDate"
          emptyMessage="No checked-in departures due today."
          actionLabel="Open Check-Out"
          actionHref="/check-out"
          onRetry={() => void departuresQuery.refetch()}
        />
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Room Status Quick View</h2>

              <span>Current room inventory</span>
            </div>

            <div className={styles.headerRight}>
              <span
                className={`${styles.connectionBadge} ${
                  connectionState === "connected"
                    ? styles.live
                    : styles.fallback
                }`}
              >
                {connectionState === "connected"
                  ? "LIVE"
                  : connectionState === "connecting"
                    ? "RECONNECTING"
                    : "REST FALLBACK"}
              </span>

              <Link href="/rooms" className={styles.headerLink}>
                View Board
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className={styles.roomContent}>
            {roomsQuery.isError ? (
              <div className={styles.messageState}>
                <Alert
                  type="error"
                  showIcon
                  message="Unable to load room status."
                  action={
                    <Button
                      size="small"
                      onClick={() => void roomsQuery.refetch()}
                    >
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : roomsQuery.isLoading ? (
              <LoadingState text="Loading room status..." />
            ) : roomsQuery.data?.length === 0 ? (
              <EmptyState text="No rooms available in the current inventory." />
            ) : (
              <>
                <div className={styles.roomSummary}>
                  {(
                    [
                      "VACANT",
                      "OCCUPIED",
                      "REQUIRES_CLEANING",
                      "UNDER_MAINTENANCE",
                    ] as const
                  ).map((status) => (
                    <div key={status} className={styles.roomSummaryItem}>
                      <span
                        className={`${styles.statusDot} ${ROOM_STATUS_CLASSES[status]}`}
                        aria-hidden="true"
                      />

                      <span>{ROOM_STATUS_LABELS[status]}</span>

                      <strong>{roomCounts?.[status] ?? 0}</strong>
                    </div>
                  ))}
                </div>

                <div className={styles.roomGrid}>
                  {previewRooms.map((room) => (
                    <RoomPreviewCard key={room.roomNumber} room={room} />
                  ))}
                </div>

                <p className={styles.previewNote}>
                  Showing {previewRooms.length} of{" "}
                  {roomsQuery.data?.length ?? 0} rooms. Open Room Status Board
                  for the complete inventory.
                </p>
              </>
            )}
          </div>
        </section>

        <div className={styles.rightColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Recent Escalations</h2>

                <span>Latest events received from WKMS</span>
              </div>

              <Link href="/escalations" className={styles.headerLink}>
                View All
                <ArrowRight size={13} />
              </Link>
            </div>

            {escalationsQuery.isError ? (
              <div className={styles.messageState}>
                <Alert
                  type="error"
                  showIcon
                  message="Unable to load escalations."
                  action={
                    <Button
                      size="small"
                      onClick={() => void escalationsQuery.refetch()}
                    >
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : escalationsQuery.isLoading ? (
              <LoadingState text="Loading escalations..." />
            ) : recentEscalations.length === 0 ? (
              <EmptyState text="No recent escalations." />
            ) : (
              <div className={styles.escalationList}>
                {recentEscalations.map((event) => (
                  <article
                    key={event.eventId}
                    className={styles.escalationItem}
                  >
                    <span className={styles.escalationIcon} aria-hidden="true">
                      <TriangleAlert size={15} />
                    </span>

                    <div className={styles.escalationDetails}>
                      <strong>Room {event.data.roomNumber}</strong>

                      <span>
                        {event.data.taskCategory
                          .replaceAll("_", " ")
                          .toLowerCase()}
                      </span>

                      <small>{formatDateTime(event.data.escalatedAt)}</small>
                    </div>

                    <span
                      className={
                        event.data.priority === "HIGH"
                          ? styles.highPriority
                          : styles.normalPriority
                      }
                    >
                      {event.data.priority}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Quick Actions</h2>

                <span>Frequently used Front Desk workflows</span>
              </div>
            </div>

            <div className={styles.quickActions}>
              <QuickAction
                href="/check-in"
                label="Guest Check-In"
                icon={LogIn}
              />

              <QuickAction
                href="/check-out"
                label="Guest Check-Out"
                icon={LogOut}
              />

              <QuickAction
                href="/walk-in"
                label="Walk-In Booking"
                icon={Plus}
              />

              <QuickAction
                href="/bookings/search"
                label="Search Booking"
                icon={Search}
              />

              <QuickAction
                href="/folio"
                label="Guest Folio"
                icon={ClipboardList}
              />

              <QuickAction
                href="/rooms"
                label="Room Status Board"
                icon={LayoutGrid}
              />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

type MetricCardProps = {
  label: string;
  value: number | null;
  loading: boolean;
  icon: LucideIcon;
  description: string;
  href: string;
  tone: "navy" | "gold" | "success" | "warning";
};

function MetricCard({
  label,
  value,
  loading,
  icon: Icon,
  description,
  href,
  tone,
}: MetricCardProps) {
  return (
    <Link href={href} className={`${styles.metricCard} ${styles[tone]}`}>
      <div className={styles.metricTop}>
        <span>{label}</span>

        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      </div>

      <strong className={styles.metricValue}>
        {loading ? "…" : (value ?? "—")}
      </strong>

      <span className={styles.metricDescription}>{description}</span>
    </Link>
  );
}

type BookingScheduleCardProps = {
  title: string;
  subtitle: string;
  bookings: BookingSearchItem[];
  loading: boolean;
  error: boolean;
  dateField: "checkInDate" | "checkOutDate";
  emptyMessage: string;
  actionLabel: string;
  actionHref: string;
  onRetry: () => void;
};

function BookingScheduleCard({
  title,
  subtitle,
  bookings,
  loading,
  error,
  dateField,
  emptyMessage,
  actionLabel,
  actionHref,
  onRetry,
}: BookingScheduleCardProps) {
  const visibleBookings = bookings.slice(0, 5);

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>

        <Link href={actionHref} className={styles.headerLink}>
          {actionLabel}
          <ArrowRight size={13} />
        </Link>
      </div>

      {error ? (
        <div className={styles.messageState}>
          <Alert
            type="error"
            showIcon
            message={`Unable to load ${title.toLowerCase()}.`}
            action={
              <Button size="small" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <LoadingState text={`Loading ${title.toLowerCase()}...`} />
      ) : bookings.length === 0 ? (
        <EmptyState text={emptyMessage} />
      ) : (
        <>
          <div className={styles.bookingList}>
            {visibleBookings.map((booking) => (
              <div key={booking.bookingId} className={styles.bookingRow}>
                <div className={styles.bookingGuest}>
                  <strong>
                    {booking.guestName ?? "Guest name unavailable"}
                  </strong>

                  <span
                    title={booking.bookingReference}
                    className={styles.bookingReference}
                  >
                    {booking.bookingReference}
                  </span>
                </div>

                <div className={styles.bookingMeta}>
                  <strong>{booking.roomType}</strong>

                  <span>{formatShortDate(booking[dateField])}</span>
                </div>
              </div>
            ))}
          </div>

          {bookings.length > visibleBookings.length && (
            <div className={styles.listFooter}>
              Showing {visibleBookings.length} of {bookings.length} bookings for
              today
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RoomPreviewCard({ room }: { room: RoomStatusBoardItem }) {
  return (
    <div
      className={`${styles.roomPreview} ${ROOM_STATUS_CLASSES[room.status]}`}
    >
      <strong>{room.roomNumber}</strong>

      <span>{ROOM_STATUS_LABELS[room.status]}</span>

      <small>{room.roomTypeName}</small>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link href={href} className={styles.quickAction}>
      <Icon size={16} strokeWidth={1.8} aria-hidden="true" />

      <span>{label}</span>

      <ArrowRight size={13} aria-hidden="true" />
    </Link>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className={styles.loadingState} role="status">
      <Spin size="small" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className={styles.emptyState}>{text}</div>;
}
