"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { Alert, Button, Empty, Input, Spin } from "antd";

import { List } from "lucide-react";

import {
  useSearchBookings,
  type BookingSearchItem,
} from "@/features/reservations";

import { useRunningFolio } from "../hooks/use-running-folio";

import type { FolioCategory, FolioCategorySummary } from "../types/folio.type";

import styles from "./guest-folio-screen.module.css";

const CATEGORY_LABELS: Record<FolioCategory, string> = {
  ROOM_CHARGES: "ROOM CHARGES",
  FOOD_AND_BEVERAGE: "FOOD & BEVERAGE",
  SERVICES: "ADDITIONAL SERVICES",
};

export function GuestFolioScreen() {
  const [query, setQuery] = useState("");

  const [hasSearched, setHasSearched] = useState(false);

  const [searchResults, setSearchResults] = useState<BookingSearchItem[]>([]);

  const [selectedBooking, setSelectedBooking] =
    useState<BookingSearchItem | null>(null);

  const searchMutation = useSearchBookings();

  const folioQuery = useRunningFolio(selectedBooking?.bookingReference ?? null);

  const nights = useMemo(() => {
    if (!selectedBooking) {
      return 0;
    }

    const checkIn = new Date(`${selectedBooking.checkInDate}T00:00:00`);

    const checkOut = new Date(`${selectedBooking.checkOutDate}T00:00:00`);

    const difference = checkOut.getTime() - checkIn.getTime();

    if (!Number.isFinite(difference) || difference <= 0) {
      return 0;
    }

    return Math.round(difference / (24 * 60 * 60 * 1000));
  }, [selectedBooking]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    setHasSearched(true);
    setSelectedBooking(null);
    setSearchResults([]);

    searchMutation.reset();

    try {
      const results = await searchMutation.mutateAsync(normalizedQuery);

      const activeStays = results.filter(
        (booking) => booking.status.toUpperCase() === "CHECKED_IN",
      );

      setSearchResults(activeStays);

      if (activeStays.length === 1) {
        setSelectedBooking(activeStays[0]);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const handleClear = () => {
    setQuery("");
    setHasSearched(false);
    setSearchResults([]);
    setSelectedBooking(null);

    searchMutation.reset();
  };

  const folio = folioQuery.data;

  const isSearching = searchMutation.isPending;

  const isLoadingFolio = Boolean(selectedBooking) && folioQuery.isLoading;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.titleRow}>
            <List size={16} strokeWidth={2} aria-hidden="true" />

            <h1>Guest Folio</h1>
          </div>

          <p>Running charges for current stay</p>
        </div>

        <div className={styles.headerActions}>
          <Button disabled title="Backend folio printing is not available yet.">
            Print Folio
          </Button>

          <Button
            type="primary"
            disabled
            title="Check-out workflow will be connected next."
          >
            Process Check-Out →
          </Button>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>SELECT GUEST</div>

        <div className={styles.searchBody}>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.field}>
              <label htmlFor="folio-search">SEARCH GUEST / BOOKING</label>

              <Input
                id="folio-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Guest name or booking reference..."
                disabled={isSearching}
                allowClear
              />
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={isSearching}
              disabled={!query.trim()}
            >
              Load Folio
            </Button>

            <Button
              htmlType="button"
              onClick={handleClear}
              disabled={isSearching}
            >
              Clear
            </Button>
          </form>

          {searchMutation.isError && (
            <Alert
              type="error"
              showIcon
              message="Unable to search bookings."
              description={
                searchMutation.error instanceof Error
                  ? searchMutation.error.message
                  : "Please try again."
              }
            />
          )}

          {hasSearched &&
            !isSearching &&
            !searchMutation.isError &&
            searchResults.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No active checked-in stay matched this search."
              />
            )}

          {searchResults.length > 1 && (
            <div className={styles.searchResults}>
              {searchResults.map((booking) => {
                const selected =
                  selectedBooking?.bookingId === booking.bookingId;

                return (
                  <button
                    key={booking.bookingId}
                    type="button"
                    className={`${styles.bookingOption} ${
                      selected ? styles.selectedBooking : ""
                    }`}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    <span>
                      <strong>
                        {booking.guestName ?? "Guest name unavailable"}
                      </strong>

                      <small>{booking.bookingReference}</small>
                    </span>

                    <span className={styles.bookingType}>
                      {booking.roomType}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedBooking && isLoadingFolio && (
        <div className={styles.loadingState} role="status">
          <Spin />

          <span>Loading running folio...</span>
        </div>
      )}

      {selectedBooking && folioQuery.isError && (
        <Alert
          type="error"
          showIcon
          className={styles.feedback}
          message="Unable to load the running folio."
          description={
            folioQuery.error instanceof Error
              ? folioQuery.error.message
              : "Please try again."
          }
        />
      )}

      {selectedBooking && folio && (
        <div className={styles.folioGrid}>
          <div className={styles.leftColumn}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>STAY SUMMARY</div>

              <div className={styles.summaryGrid}>
                <SummaryItem
                  label="GUEST NAME"
                  value={selectedBooking.guestName ?? "Unavailable"}
                />

                <SummaryItem
                  label="BOOKING REF"
                  value={folio.bookingReference}
                  mono
                />

                <SummaryItem
                  label="ROOM"
                  value={`${folio.roomNumber} — ${selectedBooking.roomType}`}
                  mono
                />

                <SummaryItem label="NIGHTS" value={String(nights)} mono />

                <SummaryItem
                  label="CHECK-IN"
                  value={formatDate(folio.checkInDate)}
                  mono
                />

                <SummaryItem
                  label="CHECK-OUT"
                  value={formatDate(folio.checkOutDate)}
                  mono
                />
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>BALANCE SUMMARY</div>

              <div className={styles.balanceGrid}>
                <div className={styles.balanceCard}>
                  <span>TOTAL CHARGES</span>

                  <strong>{formatMoney(folio.total, folio.currency)}</strong>
                </div>

                <div className={styles.balanceNotice}>
                  <span>PAYMENT SUMMARY</span>

                  <strong>Not available</strong>

                  <small>Current folio API returns charges only.</small>
                </div>
              </div>
            </section>
          </div>

          <section className={`${styles.card} ${styles.chargesCard}`}>
            <div className={styles.cardHeader}>ITEMISED CHARGES</div>

            <div className={styles.chargesTable}>
              <div className={styles.tableHeader}>
                <span>DATE</span>

                <span>DESCRIPTION</span>

                <span>{folio.currency}</span>
              </div>

              {folio.categories.map((category) => (
                <CategoryRows
                  key={category.category}
                  category={category}
                  currency={folio.currency}
                />
              ))}

              <div className={styles.totalRow}>
                <strong>Total Charges</strong>

                <strong>
                  {formatMoney(folio.total, folio.currency, false)}
                </strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
  mono?: boolean;
};

function SummaryItem({ label, value, mono = false }: SummaryItemProps) {
  return (
    <div className={styles.summaryItem}>
      <span>{label}</span>

      <strong className={mono ? styles.mono : undefined}>{value}</strong>
    </div>
  );
}

type CategoryRowsProps = {
  category: FolioCategorySummary;
  currency: "LKR";
};

function CategoryRows({ category, currency }: CategoryRowsProps) {
  return (
    <>
      <div className={styles.categoryRow}>
        {CATEGORY_LABELS[category.category]}
      </div>

      {category.items.length === 0 ? (
        <div className={styles.emptyCategory}>No charges</div>
      ) : (
        category.items.map((item) => (
          <div
            key={`${category.category}-${item.reference}`}
            className={styles.chargeRow}
          >
            <span>{formatChargeDate(item.occurredAt)}</span>

            <span>{item.description}</span>

            <span>{formatMoney(item.amount, currency, false)}</span>
          </div>
        ))
      )}

      <div className={styles.subtotalRow}>
        <span>Subtotal</span>

        <strong>{formatMoney(category.subtotal, currency, false)}</strong>
      </div>
    </>
  );
}

function formatDate(value: string) {
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

function formatChargeDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatMoney(amount: number, currency: "LKR", includeCurrency = true) {
  const formatted = new Intl.NumberFormat("en-LK", {
    maximumFractionDigits: 0,
  }).format(amount);

  return includeCurrency ? `${currency} ${formatted}` : formatted;
}
