"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Alert, Button, Empty, Input, Select, Spin } from "antd";

import { LogOut } from "lucide-react";

import {
  useSearchBookings,
  type BookingSearchItem,
} from "@/features/reservations";

import { useRunningFolio, type FolioCategory } from "@/features/folios";

import { useCheckOut } from "../hooks/use-check-out";

import type {
  CheckoutPaymentMethod,
  CheckoutResult,
} from "../types/check-out.type";

import styles from "./check-out-screen.module.css";

const CATEGORY_LABELS: Record<FolioCategory, string> = {
  ROOM_CHARGES: "ROOM CHARGES",
  FOOD_AND_BEVERAGE: "FOOD & BEVERAGE",
  SERVICES: "ADDITIONAL SERVICES",
};

type CheckOutScreenProps = {
  /*
   * Must come from the authenticated receptionist session.
   * Never hardcode a staff UUID.
   */
  performedBy?: string;
};

export function CheckOutScreen({ performedBy }: CheckOutScreenProps) {
  const [query, setQuery] = useState("");

  const [hasSearched, setHasSearched] = useState(false);

  const [searchResults, setSearchResults] = useState<BookingSearchItem[]>([]);

  const [selectedBooking, setSelectedBooking] =
    useState<BookingSearchItem | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPaymentMethod>("CASH");

  const [validationError, setValidationError] = useState<string | null>(null);

  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(
    null,
  );

  const searchMutation = useSearchBookings();

  const checkoutMutation = useCheckOut();

  const folioQuery = useRunningFolio(
    checkoutResult ? null : (selectedBooking?.bookingReference ?? null),
  );

  const folio = checkoutResult ? null : folioQuery.data;

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    setHasSearched(true);
    setSearchResults([]);
    setSelectedBooking(null);
    setCheckoutResult(null);
    setValidationError(null);

    searchMutation.reset();
    checkoutMutation.reset();

    try {
      const bookings = await searchMutation.mutateAsync(normalizedQuery);

      const activeBookings = bookings.filter(
        (booking) => booking.status.toUpperCase() === "CHECKED_IN",
      );

      setSearchResults(activeBookings);

      if (activeBookings.length === 1) {
        setSelectedBooking(activeBookings[0]);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const selectBooking = (booking: BookingSearchItem) => {
    setSelectedBooking(booking);
    setCheckoutResult(null);
    setValidationError(null);
    setPaymentMethod("CASH");

    checkoutMutation.reset();
  };

  const handleConfirmCheckout = async () => {
    setValidationError(null);

    if (!selectedBooking || !folio) {
      setValidationError(
        "Select an active checked-in guest and load the folio first.",
      );
      return;
    }

    if (!performedBy) {
      setValidationError("Authenticated receptionist identity is required.");
      return;
    }

    try {
      const result = await checkoutMutation.mutateAsync({
        bookingReference: selectedBooking.bookingReference,
        performedBy,
        paymentMethod,
      });

      setCheckoutResult(result);
    } catch {
      // The backend error is displayed below.
    }
  };

  const resetWorkflow = () => {
    setQuery("");
    setHasSearched(false);
    setSearchResults([]);
    setSelectedBooking(null);
    setCheckoutResult(null);
    setValidationError(null);
    setPaymentMethod("CASH");

    searchMutation.reset();
    checkoutMutation.reset();
  };

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <LogOut size={18} strokeWidth={2} aria-hidden="true" />

          <div>
            <h1>Guest Check-Out</h1>
            <p>Review itemised folio and settle final payment</p>
          </div>
        </div>
      </header>

      <nav className={styles.journey} aria-label="Check-out workflow steps">
        <ol>
          <li>1. Find guest</li>
          <li>2. Review folio</li>
          <li>3. Choose payment method</li>
          <li>4. Confirm check-out</li>
          <li>5. Review result</li>
        </ol>
      </nav>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.stepBadge} aria-hidden="true">
            01
          </span>
          <span>FIND GUEST FOR CHECK-OUT</span>
        </div>

        <div className={styles.searchBody}>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.field}>
              <label htmlFor="checkout-search">SEARCH GUEST / BOOKING</label>

              <Input
                id="checkout-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Guest name, booking reference, email or phone..."
                disabled={
                  searchMutation.isPending || checkoutMutation.isPending
                }
                allowClear
              />
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={searchMutation.isPending}
              disabled={!query.trim() || checkoutMutation.isPending}
            >
              Search
            </Button>
          </form>

          {searchMutation.isError && (
            <Alert
              type="error"
              showIcon
              title="Guest search failed."
              description={
                searchMutation.error instanceof Error
                  ? searchMutation.error.message
                  : "Please try again."
              }
            />
          )}

          {!hasSearched && (
            <p className={styles.helper}>
              Search for a currently checked-in guest to begin checkout.
            </p>
          )}

          {hasSearched &&
            !searchMutation.isPending &&
            !searchMutation.isError &&
            searchResults.length === 0 && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No checked-in booking matched this search."
              />
            )}
        </div>

        {searchResults.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.guestTable}>
              <caption className="fds-visually-hidden">
                Checked-in bookings for check-out
              </caption>
              <thead>
                <tr>
                  <th scope="col">GUEST</th>
                  <th scope="col">BOOKING REF</th>
                  <th scope="col">CHECK-OUT</th>
                  <th scope="col">STATUS</th>
                  <th scope="col">
                    <span className="fds-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {searchResults.map((booking) => {
                  const selected =
                    selectedBooking?.bookingId === booking.bookingId;

                  return (
                    <tr
                      key={booking.bookingId}
                      className={selected ? styles.selectedRow : undefined}
                    >
                      <td>
                        <div className={styles.guestCell}>
                          <strong>
                            {booking.guestName ?? "Guest name unavailable"}
                          </strong>

                          <small>{booking.email ?? "No email available"}</small>
                        </div>
                      </td>

                      <td className={styles.mono}>
                        {booking.bookingReference}
                      </td>

                      <td>{formatDate(booking.checkOutDate)}</td>

                      <td>
                        <span className={styles.statusBadge}>Checked In</span>
                      </td>

                      <td>
                        <Button
                          type="primary"
                          size="small"
                          disabled={checkoutMutation.isPending}
                          onClick={() => selectBooking(booking)}
                        >
                          {selected ? "Selected" : "Select →"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedBooking && !checkoutResult && folioQuery.isLoading && (
        <div className={styles.loadingState} role="status">
          <Spin />
          <span>Loading guest folio...</span>
        </div>
      )}

      {selectedBooking && !checkoutResult && folioQuery.isError && (
        <Alert
          className={styles.feedback}
          type="error"
          showIcon
          title="Unable to load guest folio."
          description={
            folioQuery.error instanceof Error
              ? folioQuery.error.message
              : "Please try again."
          }
          action={
            <Button size="small" onClick={() => void folioQuery.refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {folio && selectedBooking && (
        <div className={styles.checkoutGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.stepBadge} aria-hidden="true">
                02
              </span>
              <span>ITEMISED FOLIO</span>
            </div>

            <div className={styles.staySummary}>
              <SummaryItem
                label="GUEST"
                value={selectedBooking.guestName ?? "Unavailable"}
              />

              <SummaryItem label="ROOM" value={folio.roomNumber} mono />

              <SummaryItem
                label="STAY"
                value={`${formatDate(folio.checkInDate, false)} — ${formatDate(
                  folio.checkOutDate,
                  false,
                )}`}
                mono
              />
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.folioTable}>
                <caption className="fds-visually-hidden">
                  Itemised guest folio charges
                </caption>
                <thead>
                  <tr>
                    <th scope="col">DATE</th>
                    <th scope="col">DESCRIPTION</th>
                    <th scope="col">REF</th>
                    <th scope="col">LKR</th>
                  </tr>
                </thead>

                <tbody>
                  {folio.categories.map((category) => (
                    <FragmentCategory
                      key={category.category}
                      label={CATEGORY_LABELS[category.category]}
                      items={category.items}
                      subtotal={category.subtotal}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.folioTotal}>
              <strong>Total Folio Charges</strong>
              <strong>{formatMoney(folio.total)}</strong>
            </div>
          </section>

          <div className={styles.rightColumn}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.stepBadge} aria-hidden="true">
                  03
                </span>
                <span>PAYMENT SETTLEMENT</span>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.paymentSummary}>
                  <span>TOTAL FOLIO CHARGES</span>
                  <strong>{formatMoney(folio.total)}</strong>
                </div>

                <div className={styles.field}>
                  <label htmlFor="checkout-payment-method">
                    PAYMENT METHOD
                  </label>

                  <Select<CheckoutPaymentMethod>
                    id="checkout-payment-method"
                    className={styles.fullWidth}
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    disabled={checkoutMutation.isPending}
                    options={[
                      {
                        value: "CASH",
                        label: "Cash",
                      },
                      {
                        value: "CARD_ON_SITE",
                        label: "Card on Site",
                      },
                    ]}
                  />
                </div>

                <Alert
                  type="info"
                  showIcon
                  title="Final payment is calculated by the backend."
                  description="Completed deposits and the outstanding balance will be confirmed during checkout. The total above is not necessarily the amount due."
                />
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.stepBadge} aria-hidden="true">
                  04
                </span>
                <span>CHECK-OUT CONFIRMATION</span>
              </div>

              <div className={styles.cardBody}>
                <Alert
                  type="warning"
                  showIcon
                  title="After successful checkout"
                  description="The room will become Requires Cleaning, a cleaning event will be sent to WKMS, and FOSS deactivation will be attempted."
                />

                {!performedBy && (
                  <Alert
                    type="warning"
                    showIcon
                    title="An active receptionist or ROOT session is required to confirm checkout."
                    description="Sign in again with an authorized account, then retry. Checkout has not been submitted."
                  />
                )}

                {validationError && (
                  <Alert type="error" showIcon title={validationError} />
                )}

                {checkoutMutation.isError && (
                  <Alert
                    type="error"
                    showIcon
                    title="Guest checkout could not be completed."
                    description={
                      checkoutMutation.error instanceof Error
                        ? checkoutMutation.error.message
                        : "Please try again."
                    }
                  />
                )}

                <Button
                  type="primary"
                  block
                  className={styles.confirmButton}
                  loading={checkoutMutation.isPending}
                  disabled={!performedBy || !folio}
                  onClick={() => void handleConfirmCheckout()}
                >
                  Confirm Check-Out & Settle →
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}

      {checkoutResult && (
        <div className={styles.resultGrid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.stepBadge} aria-hidden="true">
                05
              </span>
              <span>FINAL SETTLEMENT — BACKEND CONFIRMED</span>
            </div>

            <div className={styles.finalSummary}>
              <SummaryItem
                label="TOTAL CHARGES"
                value={formatMoney(checkoutResult.folioTotal)}
                mono
              />

              <SummaryItem
                label="PREVIOUSLY PAID"
                value={formatMoney(checkoutResult.previouslyPaid)}
                mono
              />

              <SummaryItem
                label="FINAL PAYMENT"
                value={formatMoney(checkoutResult.finalPaymentAmount)}
                mono
              />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>SUBSYSTEM RESULTS</div>

            <div className={styles.cardBody}>
              <Alert
                type="success"
                showIcon
                title={`Room ${checkoutResult.roomNumber} → Requires Cleaning`}
              />

              {checkoutResult.fossSession.status === "DEACTIVATED" ? (
                <Alert
                  type="success"
                  showIcon
                  title="FOSS session deactivated."
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  title="Checkout succeeded, but FOSS deactivation failed."
                  description="The core hotel checkout has already been committed."
                />
              )}
            </div>
          </section>
        </div>
      )}

      {checkoutResult && (
        <Alert
          type="success"
          showIcon
          className={styles.feedback}
          title="Guest check-out completed successfully."
          description={
            <div className={styles.resultDetails}>
              <span>
                Booking: <strong>{checkoutResult.bookingReference}</strong>
              </span>

              <span>
                Room: <strong>{checkoutResult.roomNumber}</strong>
              </span>

              <span>
                Room status: <strong>Requires Cleaning</strong>
              </span>
            </div>
          }
          action={
            <Button size="small" onClick={resetWorkflow}>
              New Check-Out
            </Button>
          }
        />
      )}
    </section>
  );
}

type FolioRowItem = {
  reference: string;
  description: string;
  amount: number;
  occurredAt: string;
};

type FragmentCategoryProps = {
  label: string;
  items: FolioRowItem[];
  subtotal: number;
};

function FragmentCategory({ label, items, subtotal }: FragmentCategoryProps) {
  return (
    <>
      <tr className={styles.categoryRow}>
        <td colSpan={4}>{label}</td>
      </tr>

      {items.length === 0 ? (
        <tr>
          <td colSpan={4} className={styles.emptyCharges}>
            No charges
          </td>
        </tr>
      ) : (
        items.map((item) => (
          <tr key={`${label}-${item.reference}`}>
            <td>{formatTimestamp(item.occurredAt)}</td>

            <td>{item.description}</td>

            <td className={styles.mono}>{item.reference}</td>

            <td className={styles.moneyCell}>
              {formatMoney(item.amount, false)}
            </td>
          </tr>
        ))
      )}

      <tr className={styles.subtotalRow}>
        <td colSpan={3}>Subtotal</td>
        <td className={styles.moneyCell}>{formatMoney(subtotal, false)}</td>
      </tr>
    </>
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

function formatDate(value: string, includeYear = true) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatMoney(amount: number, includeCurrency = true) {
  const formatted = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

  return includeCurrency ? `LKR ${formatted}` : formatted;
}
