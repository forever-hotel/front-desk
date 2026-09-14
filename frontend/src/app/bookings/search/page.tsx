"use client";

import { useMemo, useState } from "react";
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

import styles from "./search-booking.module.css";

type SearchField =
  | "all"
  | "guest"
  | "booking"
  | "nic"
  | "email"
  | "phone";

type BookingStatus =
  | "PENDING"
  | "CHECKED_IN"
  | "CHECKED_OUT";

type BookingSource = "Website" | "Booking.lk";

type Booking = {
  guestName: string;
  email: string;
  bookingReference: string;
  room: string;
  checkIn: string;
  checkOut: string;
  source: BookingSource;
  status: BookingStatus;
  nicOrPassport: string;
  phone: string;
};

const bookings: Booking[] = [
  {
    guestName: "Thilini Weerasinghe",
    email: "thilini@email.com",
    bookingReference: "#FH-2026-0419",
    room: "TBD",
    checkIn: "10 Apr 2026",
    checkOut: "13 Apr 2026",
    source: "Website",
    status: "PENDING",
    nicOrPassport: "200012345678",
    phone: "0771234567",
  },
  {
    guestName: "Kamal Fernando",
    email: "kamal@email.com",
    bookingReference: "#BK-2026-0088",
    room: "204",
    checkIn: "09 Apr 2026",
    checkOut: "11 Apr 2026",
    source: "Booking.lk",
    status: "CHECKED_IN",
    nicOrPassport: "981234567V",
    phone: "0712345678",
  },
  {
    guestName: "Ruchira Bandara",
    email: "ruchira@email.com",
    bookingReference: "#FH-2026-0398",
    room: "204",
    checkIn: "08 Apr 2026",
    checkOut: "10 Apr 2026",
    source: "Website",
    status: "CHECKED_OUT",
    nicOrPassport: "199912345678",
    phone: "0751234567",
  },
];

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
    value: "nic",
    label: "NIC / Passport",
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
    useState<SearchField>("all");

  const [submittedQuery, setSubmittedQuery] =
    useState("");

  const [submittedField, setSubmittedField] =
    useState<SearchField>("all");

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = submittedQuery
      .trim()
      .toLowerCase();

    if (!normalizedQuery) {
      return bookings;
    }

    return bookings.filter((booking) => {
      const matches = (value: string) =>
        value.toLowerCase().includes(normalizedQuery);

      switch (submittedField) {
        case "guest":
          return matches(booking.guestName);

        case "booking":
          return matches(booking.bookingReference);

        case "nic":
          return matches(booking.nicOrPassport);

        case "email":
          return matches(booking.email);

        case "phone":
          return matches(booking.phone);

        case "all":
        default:
          return (
            matches(booking.guestName) ||
            matches(booking.bookingReference) ||
            matches(booking.nicOrPassport) ||
            matches(booking.email) ||
            matches(booking.phone)
          );
      }
    });
  }, [submittedField, submittedQuery]);

  const handleSearch = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setIsLoading(true);
    setError(null);

    try {
      /*
       * Temporary delay used to demonstrate the loading
       * state before real backend integration.
       */
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 500);
      });

      /*
       * Temporary mock error trigger.
       * Remove this when the real API is integrated.
       */
      if (query.trim().toLowerCase() === "error") {
        throw new Error("Mock booking search failure");
      }

      setSubmittedQuery(query);
      setSubmittedField(searchBy);
    } catch {
      setError(
        "Unable to search bookings. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearchBy("all");

    setSubmittedQuery("");
    setSubmittedField("all");

    setError(null);
    setIsLoading(false);
  };

  const columns: TableColumnsType<Booking> = [
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
        <span className={styles.bookingReference}>
          {reference}
        </span>
      ),
    },
    {
      title: "Room",
      dataIndex: "room",
      key: "room",
    },
    {
      title: "Check-In",
      dataIndex: "checkIn",
      key: "checkIn",
    },
    {
      title: "Check-Out",
      dataIndex: "checkOut",
      key: "checkOut",
    },
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      render: (source: BookingSource) => (
        <Tag className={styles.sourceTag}>
          {source}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: BookingStatus) => (
        <BookingStatusTag status={status} />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, booking) => (
        <BookingActions status={booking.status} />
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
          Search by name, booking ref, NIC/passport,
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
                placeholder="Guest name, booking ref, NIC/passport, email or phone..."
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
                onChange={(value: SearchField) =>
                  setSearchBy(value)
                }
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
                message="Booking search failed"
                description={error}
              />
            </div>
          ) : isLoading ? (
            <div className={styles.loadingState}>
              <Spin size="default" />

              <span>Searching bookings...</span>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className={styles.emptyState}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No bookings found."
              />
            </div>
          ) : (
            <Table<Booking>
              columns={columns}
              dataSource={filteredBookings}
              rowKey="bookingReference"
              pagination={false}
              size="middle"
              scroll={{ x: 950 }}
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

function BookingStatusTag({
  status,
}: {
  status: BookingStatus;
}) {
  if (status === "PENDING") {
    return (
      <Tag className={styles.pendingTag}>
        Pending
      </Tag>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <Tag className={styles.checkedInTag}>
        Checked In
      </Tag>
    );
  }

  return (
    <Tag className={styles.checkedOutTag}>
      Checked Out
    </Tag>
  );
}

function BookingActions({
  status,
}: {
  status: BookingStatus;
}) {
  if (status === "PENDING") {
    return (
      <div className={styles.actionGroup}>
        <Button type="primary" size="small">
          Check-In
        </Button>

        <Button size="small">
          Folio
        </Button>
      </div>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <div className={styles.actionGroup}>
        <Button type="primary" size="small">
          Check-Out
        </Button>

        <Button size="small">
          Folio
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.actionGroup}>
      <Button size="small">
        Receipt
      </Button>
    </div>
  );
}