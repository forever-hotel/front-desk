"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Alert, Button, Empty, Input, Select, Spin, Table, Tag } from "antd";

import type { TableColumnsType } from "antd";

import { Search } from "lucide-react";

import { useRecentBookings } from "../hooks/use-recent-bookings";
import { useSearchBookings } from "../hooks/use-search-bookings";

import type {
  BookingSearchField,
  BookingSearchItem,
} from "../types/reservation.type";

import styles from "./booking-search-screen.module.css";

const SEARCH_BY_OPTIONS = [
  {
    value: "all",
    label: "All Fields",
  },
  {
    value: "guest",
    label: "Guest Name",
  },
  {
    value: "booking",
    label: "Booking Reference",
  },
  {
    value: "email",
    label: "Email",
  },
  {
    value: "phone",
    label: "Phone",
  },
] satisfies Array<{
  value: BookingSearchField;
  label: string;
}>;

export function BookingSearchScreen() {
  const [query, setQuery] = useState("");
  const [searchBy, setSearchBy] = useState<BookingSearchField>("all");

  const [hasSearched, setHasSearched] = useState(false);

  const [searchResults, setSearchResults] = useState<
    BookingSearchItem[] | null
  >(null);

  const recentBookingsQuery = useRecentBookings(5);
  const searchBookingsMutation = useSearchBookings();

  const bookings = searchResults ?? recentBookingsQuery.data ?? [];

  const isLoading =
    searchBookingsMutation.isPending ||
    (!hasSearched && recentBookingsQuery.isLoading);

  const error = hasSearched
    ? searchBookingsMutation.error
    : recentBookingsQuery.error;

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      handleClear();

      await recentBookingsQuery.refetch();

      return;
    }

    setHasSearched(true);
    searchBookingsMutation.reset();

    try {
      const results = await searchBookingsMutation.mutateAsync(normalizedQuery);

      setSearchResults(
        filterBookingsByField(results, normalizedQuery, searchBy),
      );
    } catch {
      setSearchResults([]);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearchBy("all");
    setHasSearched(false);
    setSearchResults(null);

    searchBookingsMutation.reset();
  };

  const columns: TableColumnsType<BookingSearchItem> = [
    {
      title: "Guest Name",
      key: "guestName",

      render: (_, booking) => (
        <div className={styles.guestCell}>
          <span className={styles.guestName}>
            {booking.guestName ?? "Guest name unavailable"}
          </span>

          <span className={styles.guestEmail}>
            {booking.email ?? "No email available"}
          </span>
        </div>
      ),
    },

    {
      title: "Booking Ref",
      dataIndex: "bookingReference",
      key: "bookingReference",

      render: (reference: string) => (
        <span className={styles.bookingReference}>{reference}</span>
      ),
    },

    {
      title: "Room Type",
      dataIndex: "roomType",
      key: "roomType",
    },

    {
      title: "Check-In",
      dataIndex: "checkInDate",
      key: "checkInDate",

      render: (date: string) => formatBookingDate(date),
    },

    {
      title: "Check-Out",
      dataIndex: "checkOutDate",
      key: "checkOutDate",

      render: (date: string) => formatBookingDate(date),
    },

    {
      title: "Status",
      dataIndex: "status",
      key: "status",

      render: (status: string) => <BookingStatusTag status={status} />,
    },

    {
      title: "Actions",
      key: "actions",

      render: (_, booking) => <BookingActions status={booking.status} />,
    },
  ];

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <Search size={16} strokeWidth={2} aria-hidden="true" />

          <h1>Search Booking</h1>
        </div>

        <p>Search by guest name, booking reference, email or phone</p>
      </header>

      <div className={styles.searchCard}>
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="booking-search-query">SEARCH QUERY</label>

              <Input
                id="booking-search-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Guest name, booking ref, email or phone..."
                disabled={isLoading}
                allowClear
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="booking-search-by">SEARCH BY</label>

              <Select<BookingSearchField>
                id="booking-search-by"
                value={searchBy}
                options={SEARCH_BY_OPTIONS}
                onChange={setSearchBy}
                disabled={isLoading}
                className={styles.select}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <Button
              type="primary"
              htmlType="submit"
              loading={searchBookingsMutation.isPending}
            >
              Search
            </Button>

            <Button
              htmlType="button"
              onClick={handleClear}
              disabled={isLoading}
            >
              Clear
            </Button>
          </div>
        </form>

        <div className={styles.results} aria-live="polite">
          {error ? (
            <div className={styles.stateContainer}>
              <Alert
                type="error"
                showIcon
                message={
                  hasSearched
                    ? "Booking search failed"
                    : "Recent bookings could not be loaded"
                }
                description={
                  hasSearched
                    ? "Unable to search bookings. Please try again."
                    : "Unable to load recent bookings. Please try again."
                }
              />
            </div>
          ) : isLoading ? (
            <div className={styles.loadingState}>
              <Spin />

              <span>
                {hasSearched
                  ? "Searching bookings..."
                  : "Loading recent bookings..."}
              </span>
            </div>
          ) : bookings.length === 0 ? (
            <div className={styles.emptyState}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hasSearched
                    ? "No bookings found."
                    : "No recent bookings available."
                }
              />
            </div>
          ) : (
            <Table<BookingSearchItem>
              columns={columns}
              dataSource={bookings}
              rowKey="bookingId"
              pagination={false}
              size="middle"
              scroll={{ x: 900 }}
              rowClassName={(_, index) =>
                index % 2 === 1 ? styles.alternateRow : ""
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}

function filterBookingsByField(
  bookings: BookingSearchItem[],
  query: string,
  field: BookingSearchField,
) {
  if (field === "all") {
    return bookings;
  }

  const normalizedQuery = query.toLowerCase();

  return bookings.filter((booking) => {
    switch (field) {
      case "guest":
        return (booking.guestName ?? "")
          .toLowerCase()
          .includes(normalizedQuery);

      case "booking":
        return booking.bookingReference.toLowerCase().includes(normalizedQuery);

      case "email":
        return (booking.email ?? "").toLowerCase().includes(normalizedQuery);

      case "phone":
        return (booking.phone ?? "").toLowerCase().includes(normalizedQuery);

      default:
        return true;
    }
  });
}

function formatBookingDate(value: string) {
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

function BookingStatusTag({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === "CONFIRMED" || normalizedStatus === "PENDING") {
    return (
      <Tag
        className={
          normalizedStatus === "CONFIRMED"
            ? styles.confirmedTag
            : styles.pendingTag
        }
      >
        {normalizedStatus === "CONFIRMED" ? "Confirmed" : "Pending"}
      </Tag>
    );
  }

  if (normalizedStatus === "CHECKED_IN") {
    return <Tag className={styles.checkedInTag}>Checked In</Tag>;
  }

  if (normalizedStatus === "CHECKED_OUT") {
    return <Tag className={styles.checkedOutTag}>Checked Out</Tag>;
  }

  return <Tag>{status}</Tag>;
}

function BookingActions({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === "CONFIRMED" || normalizedStatus === "PENDING") {
    return (
      <div className={styles.actionGroup}>
        <Button type="primary" size="small">
          Check-In
        </Button>

        <Button size="small">Folio</Button>
      </div>
    );
  }

  if (normalizedStatus === "CHECKED_IN") {
    return (
      <div className={styles.actionGroup}>
        <Button type="primary" size="small">
          Check-Out
        </Button>

        <Button size="small">Folio</Button>
      </div>
    );
  }

  if (normalizedStatus === "CHECKED_OUT") {
    return (
      <div className={styles.actionGroup}>
        <Button size="small">Receipt</Button>
      </div>
    );
  }

  return null;
}
