"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Search } from "lucide-react";

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
       * Temporary delay used only to demonstrate the
       * loading state before real backend integration.
       */
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 500);
      });

      /*
       * Temporary error trigger for DDP-16 UI testing.
       * This will be removed when the real Booking
       * Search API is connected.
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

  return (
    <section className="search-booking-page">
      <header className="search-booking-title">
        <div className="search-booking-title-line">
          <Search
            size={15}
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

      <div className="search-booking-card">
        <form
          className="search-booking-form"
          onSubmit={handleSearch}
        >
          <div className="search-booking-fields">
            <div className="search-field search-query-field">
              <label htmlFor="search-query">
                SEARCH QUERY
              </label>

              <input
                id="search-query"
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Guest name, booking ref, NIC/passport, email or phone..."
                disabled={isLoading}
              />
            </div>

            <div className="search-field search-by-field">
              <label htmlFor="search-by">
                SEARCH BY
              </label>

              <select
                id="search-by"
                value={searchBy}
                onChange={(event) =>
                  setSearchBy(
                    event.target.value as SearchField,
                  )
                }
                disabled={isLoading}
              >
                <option value="all">
                  All Fields
                </option>

                <option value="guest">
                  Guest Name
                </option>

                <option value="booking">
                  Booking Reference
                </option>

                <option value="nic">
                  NIC / Passport
                </option>

                <option value="email">
                  Email
                </option>

                <option value="phone">
                  Phone
                </option>
              </select>
            </div>
          </div>

          <div className="search-booking-actions">
            <button
              type="submit"
              className="search-primary-button"
              disabled={isLoading}
            >
              {isLoading ? "Searching..." : "Search"}
            </button>

            <button
              type="button"
              className="search-clear-button"
              onClick={handleClear}
              disabled={isLoading}
            >
              Clear
            </button>
          </div>
        </form>

        <div className="search-results-wrapper">
          {isLoading ? (
            <div
              className="search-feedback-state"
              role="status"
            >
              <span
                className="search-loading-spinner"
                aria-hidden="true"
              />

              <span>Searching bookings...</span>
            </div>
          ) : error ? (
            <div
              className="search-feedback-state search-error-state"
              role="alert"
            >
              {error}
            </div>
          ) : filteredBookings.length > 0 ? (
            <table className="search-results-table">
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Booking Ref</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking.bookingReference}>
                    <td>
                      <div className="guest-cell">
                        <span className="guest-name">
                          {booking.guestName}
                        </span>

                        <span className="guest-email">
                          {booking.email}
                        </span>
                      </div>
                    </td>

                    <td className="booking-ref-cell">
                      {booking.bookingReference}
                    </td>

                    <td>{booking.room}</td>

                    <td>{booking.checkIn}</td>

                    <td>{booking.checkOut}</td>

                    <td>
                      <span className="source-badge">
                        {booking.source}
                      </span>
                    </td>

                    <td>
                      <StatusBadge
                        status={booking.status}
                      />
                    </td>

                    <td>
                      <BookingActions
                        status={booking.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="search-empty-state">
              No bookings found.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({
  status,
}: {
  status: BookingStatus;
}) {
  if (status === "PENDING") {
    return (
      <span className="status-pill status-pending">
        <span className="status-dot" />
        Pending
      </span>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <span className="status-pill status-checked-in">
        <span className="status-dot" />
        Checked In
      </span>
    );
  }

  return (
    <span className="status-pill status-checked-out">
      <span className="status-dot" />
      Checked Out
    </span>
  );
}

function BookingActions({
  status,
}: {
  status: BookingStatus;
}) {
  if (status === "PENDING") {
    return (
      <div className="booking-action-group">
        <button
          type="button"
          className="table-primary-button"
        >
          Check-In
        </button>

        <button
          type="button"
          className="table-secondary-button"
        >
          Folio
        </button>
      </div>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <div className="booking-action-group">
        <button
          type="button"
          className="table-primary-button"
        >
          Check-Out
        </button>

        <button
          type="button"
          className="table-secondary-button"
        >
          Folio
        </button>
      </div>
    );
  }

  return (
    <div className="booking-action-group">
      <button
        type="button"
        className="table-secondary-button"
      >
        Receipt
      </button>
    </div>
  );
}