"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { FormEvent } from "react";
import type { TableColumnsType } from "antd";

import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";

import { Search } from "lucide-react";

import {
  getRecentBookings,
  searchBookings,
} from "@/services/booking-search-api";

import type {
  BookingSearchField,
  BookingSearchItem,
} from "@/types/booking";

import styles from "./search-booking.module.css";

const searchByOptions = [
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
];

export default function BookingSearchPage() {
  const [query, setQuery] = useState("");

  const [searchBy, setSearchBy] =
    useState<BookingSearchField>("all");

  const [bookings, setBookings] = useState<
    BookingSearchItem[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [hasSearched, setHasSearched] =
    useState(false);

  /*
   * Load the most recent bookings.
   *
   * This is used:
   * - when the page first opens
   * - when Clear is clicked
   * - when an empty search is submitted
   */
  const loadRecentBookings =
    useCallback(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const recentBookings =
          await getRecentBookings(5);

        setBookings(recentBookings);
        setHasSearched(false);
      } catch (recentError) {
        console.error(
          "Recent bookings failed:",
          recentError,
        );

        setBookings([]);

        setError(
          "Unable to load recent bookings. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  /*
   * Load recent bookings when the page first opens.
   */
  useEffect(() => {
    void loadRecentBookings();
  }, [loadRecentBookings]);

  /*
   * Search bookings using the backend.
   */
  const handleSearch = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedQuery = query.trim();

    /*
     * If the user submits an empty search,
     * restore recent bookings instead.
     */
    if (!normalizedQuery) {
      setQuery("");
      setSearchBy("all");

      await loadRecentBookings();

      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const results =
        await searchBookings(normalizedQuery);

      /*
       * The current backend endpoint performs a
       * general query search.
       *
       * Search By is applied as a secondary
       * frontend filter using fields returned
       * by the backend.
       */
      const filteredResults =
        filterBookingsByField(
          results,
          normalizedQuery,
          searchBy,
        );

      setBookings(filteredResults);
    } catch (searchError) {
      console.error(
        "Booking search failed:",
        searchError,
      );

      setBookings([]);

      setError(
        "Unable to search bookings. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  /*
   * Reset the form and restore recent bookings.
   */
  const handleClear = () => {
    setQuery("");
    setSearchBy("all");

    void loadRecentBookings();
  };

  const columns: TableColumnsType<BookingSearchItem> =
    [
      {
        title: "Guest Name",
        key: "guestName",

        render: (_, booking) => (
          <div className={styles.guestCell}>
            <span className={styles.guestName}>
              {booking.guestName}
            </span>

            <span className={styles.guestEmail}>
              {booking.email}
            </span>
          </div>
        ),
      },

      {
        title: "Booking Ref",
        dataIndex: "bookingReference",
        key: "bookingReference",

        render: (reference: string) => (
          <span
            className={
              styles.bookingReference
            }
          >
            {reference}
          </span>
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

        render: (date: string) =>
          formatBookingDate(date),
      },

      {
        title: "Check-Out",
        dataIndex: "checkOutDate",
        key: "checkOutDate",

        render: (date: string) =>
          formatBookingDate(date),
      },

      {
        title: "Status",
        dataIndex: "status",
        key: "status",

        render: (status: string) => (
          <BookingStatusTag
            status={status}
          />
        ),
      },

      {
        title: "Actions",
        key: "actions",

        render: (_, booking) => (
          <BookingActions
            status={booking.status}
          />
        ),
      },
    ];

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <Search
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />

          <h1>Search Booking</h1>
        </div>

        <p>
          Search by guest name, booking reference,
          email or phone
        </p>
      </header>

      <div className={styles.searchCard}>
        <form
          className={styles.searchForm}
          onSubmit={handleSearch}
        >
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="booking-search-query">
                SEARCH QUERY
              </label>

              <Input
                id="booking-search-query"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Guest name, booking ref, email or phone..."
                disabled={isLoading}
                allowClear
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="booking-search-by">
                SEARCH BY
              </label>

              <Select
                id="booking-search-by"
                value={searchBy}
                options={searchByOptions}
                onChange={(
                  value: BookingSearchField,
                ) => setSearchBy(value)}
                disabled={isLoading}
                className={styles.select}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
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

        <div className={styles.results}>
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
                description={error}
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
                image={
                  Empty.PRESENTED_IMAGE_SIMPLE
                }
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
                index % 2 === 1
                  ? styles.alternateRow
                  : ""
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}

/*
 * Apply the selected Search By filter.
 *
 * The backend currently performs the general search,
 * while this function narrows the returned records
 * to the selected field.
 */
function filterBookingsByField(
  bookings: BookingSearchItem[],
  query: string,
  field: BookingSearchField,
) {
  if (field === "all") {
    return bookings;
  }

  const normalizedQuery =
    query.toLowerCase();

  return bookings.filter((booking) => {
    switch (field) {
      case "guest":
        return booking.guestName
          .toLowerCase()
          .includes(normalizedQuery);

      case "booking":
        return booking.bookingReference
          .toLowerCase()
          .includes(normalizedQuery);

      case "email":
        return booking.email
          .toLowerCase()
          .includes(normalizedQuery);

      case "phone":
        return booking.phone
          .toLowerCase()
          .includes(normalizedQuery);

      default:
        return true;
    }
  });
}

/*
 * Convert backend ISO date values such as:
 * 2026-09-10
 *
 * into:
 * 10 Sept 2026
 */
function formatBookingDate(
  value: string,
) {
  const date = new Date(
    `${value}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

/*
 * Booking status presentation.
 */
function BookingStatusTag({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toUpperCase();

  if (
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "PENDING"
  ) {
    return (
      <Tag
        className={
          styles.confirmedTag
        }
      >
        {normalizedStatus === "CONFIRMED"
          ? "Confirmed"
          : "Pending"}
      </Tag>
    );
  }

  if (
    normalizedStatus === "CHECKED_IN"
  ) {
    return (
      <Tag
        className={
          styles.checkedInTag
        }
      >
        Checked In
      </Tag>
    );
  }

  if (
    normalizedStatus === "CHECKED_OUT"
  ) {
    return (
      <Tag
        className={
          styles.checkedOutTag
        }
      >
        Checked Out
      </Tag>
    );
  }

  return <Tag>{status}</Tag>;
}

/*
 * Actions shown according to booking status.
 *
 * These buttons are currently UI-only.
 * Their business flows are handled by
 * their respective FDS development tasks.
 */
function BookingActions({
  status,
}: {
  status: string;
}) {
  const normalizedStatus =
    status.toUpperCase();

  if (
    normalizedStatus === "CONFIRMED" ||
    normalizedStatus === "PENDING"
  ) {
    return (
      <div className={styles.actionGroup}>
        <Button
          type="primary"
          size="small"
        >
          Check-In
        </Button>

        <Button size="small">
          Folio
        </Button>
      </div>
    );
  }

  if (
    normalizedStatus === "CHECKED_IN"
  ) {
    return (
      <div className={styles.actionGroup}>
        <Button
          type="primary"
          size="small"
        >
          Check-Out
        </Button>

        <Button size="small">
          Folio
        </Button>
      </div>
    );
  }

  if (
    normalizedStatus === "CHECKED_OUT"
  ) {
    return (
      <div className={styles.actionGroup}>
        <Button size="small">
          Receipt
        </Button>
      </div>
    );
  }

  return null;
}