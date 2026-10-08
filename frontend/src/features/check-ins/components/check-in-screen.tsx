"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { Alert, Button, Checkbox, Empty, Input, Select, Spin } from "antd";

import { LogIn } from "lucide-react";

import {
  useSearchBookings,
  type BookingSearchField,
  type BookingSearchItem,
} from "@/features/reservations";

import { useRoomStatus, type RoomStatusBoardItem } from "@/features/rooms";

import { useCheckIn } from "../hooks/use-check-in";
import { useCheckInPrint } from "../hooks/use-check-in-print";

import type {
  CheckInResult,
  IdentityDocumentType,
} from "../types/check-in.type";

import styles from "./check-in-screen.module.css";

const SEARCH_BY_OPTIONS = [
  {
    value: "all",
    label: "All Fields",
  },
  {
    value: "booking",
    label: "Booking Reference",
  },
  {
    value: "guest",
    label: "Guest Name",
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

const DOCUMENT_TYPE_OPTIONS = [
  {
    value: "NIC",
    label: "National Identity Card (NIC)",
  },
  {
    value: "PASSPORT",
    label: "Passport",
  },
  {
    value: "OTHER",
    label: "Other Identity Document",
  },
] satisfies Array<{
  value: IdentityDocumentType;
  label: string;
}>;

type CheckInScreenProps = {
  /*
   * Later this must come from the authenticated
   * Front Desk session/principal.
   *
   * Never hardcode a receptionist UUID here.
   */
  performedBy?: string;
};

export function CheckInScreen({ performedBy }: CheckInScreenProps) {
  const [query, setQuery] = useState("");

  const [searchBy, setSearchBy] = useState<BookingSearchField>("all");

  const [hasSearched, setHasSearched] = useState(false);

  const [searchResults, setSearchResults] = useState<BookingSearchItem[]>([]);

  const [selectedBooking, setSelectedBooking] =
    useState<BookingSearchItem | null>(null);

  const [documentType, setDocumentType] = useState<IdentityDocumentType>("NIC");

  const [physicalDocumentVerified, setPhysicalDocumentVerified] =
    useState(false);

  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>();

  const [validationError, setValidationError] = useState<string | null>(null);

  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(
    null,
  );

  const searchMutation = useSearchBookings();

  const {
    data: rooms = [],
    isLoading: roomsLoading,
    error: roomsError,
  } = useRoomStatus();

  const checkInMutation = useCheckIn();

  const printMutation = useCheckInPrint();

  const compatibleRooms = useMemo(() => {
    if (!selectedBooking) {
      return [];
    }

    return rooms
      .filter(
        (room) =>
          room.status === "VACANT" &&
          room.roomTypeName.trim().toLowerCase() ===
            selectedBooking.roomType.trim().toLowerCase(),
      )
      .sort((left, right) =>
        left.roomNumber.localeCompare(right.roomNumber, undefined, {
          numeric: true,
        }),
      );
  }, [rooms, selectedBooking]);

  const nights = useMemo(() => {
    if (!selectedBooking) {
      return 0;
    }

    const checkInDate = new Date(`${selectedBooking.checkInDate}T00:00:00`);

    const checkOutDate = new Date(`${selectedBooking.checkOutDate}T00:00:00`);

    const difference = checkOutDate.getTime() - checkInDate.getTime();

    if (!Number.isFinite(difference) || difference <= 0) {
      return 0;
    }

    return Math.round(difference / (24 * 60 * 60 * 1000));
  }, [selectedBooking]);

  const activeStep =
    checkInResult !== null
      ? 4
      : selectedRoomNumber
        ? 4
        : physicalDocumentVerified
          ? 3
          : selectedBooking
            ? 2
            : 1;

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    setHasSearched(true);
    setSelectedBooking(null);
    setSelectedRoomNumber(undefined);
    setPhysicalDocumentVerified(false);
    setCheckInResult(null);
    setValidationError(null);

    searchMutation.reset();
    checkInMutation.reset();
    printMutation.reset();

    try {
      const results = await searchMutation.mutateAsync(normalizedQuery);

      const filtered = filterBookingsByField(
        results,
        normalizedQuery,
        searchBy,
      ).filter((booking) => booking.status.toUpperCase() === "CONFIRMED");

      setSearchResults(filtered);

      if (filtered.length === 1) {
        selectBooking(filtered[0]);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const selectBooking = (booking: BookingSearchItem) => {
    setSelectedBooking(booking);
    setSelectedRoomNumber(undefined);
    setPhysicalDocumentVerified(false);
    setDocumentType("NIC");
    setCheckInResult(null);
    setValidationError(null);

    checkInMutation.reset();
    printMutation.reset();
  };

  const handleCheckIn = async () => {
    setValidationError(null);

    if (!selectedBooking) {
      setValidationError("Please select a confirmed booking.");

      return;
    }

    if (!physicalDocumentVerified) {
      setValidationError(
        "Physical identity document verification must be completed.",
      );

      return;
    }

    if (!selectedRoomNumber) {
      setValidationError("Please assign a vacant compatible room.");

      return;
    }

    if (!performedBy) {
      setValidationError(
        "Authenticated receptionist identity is required before check-in can be submitted.",
      );

      return;
    }

    try {
      const result = await checkInMutation.mutateAsync({
        bookingReference: selectedBooking.bookingReference,

        roomNumber: selectedRoomNumber,

        verification: {
          documentType,

          verificationMethod: "PHYSICAL_DOCUMENT",

          verifiedBy: performedBy,
        },
      });

      setCheckInResult(result);
    } catch {
      /*
       * Backend error is rendered below.
       */
    }
  };

  const handlePrintRegistrationCard = async () => {
    if (!checkInResult) {
      return;
    }

    try {
      await printMutation.mutateAsync({
        bookingReference: checkInResult.bookingReference,

        payload: {
          documentType: "REGISTRATION_CARD",
        },
      });
    } catch {
      /*
       * Print error is rendered below.
       */
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <LogIn size={17} strokeWidth={2} aria-hidden="true" />

          <div>
            <h1>Guest Check-In</h1>

            <p>Process arrival for pre-booked guests</p>
          </div>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>STEP 1 — FIND BOOKING</div>

        <div className={styles.stepper} aria-label="Check-in progress">
          <StepItem step={1} label="FIND BOOKING" activeStep={activeStep} />

          <StepItem step={2} label="VERIFY ID" activeStep={activeStep} />

          <StepItem step={3} label="ASSIGN ROOM" activeStep={activeStep} />

          <StepItem step={4} label="CONFIRM" activeStep={activeStep} />
        </div>

        <form className={styles.searchGrid} onSubmit={handleSearch}>
          <div className={styles.field}>
            <label htmlFor="check-in-search-by">SEARCH BY</label>

            <Select<BookingSearchField>
              id="check-in-search-by"
              value={searchBy}
              options={SEARCH_BY_OPTIONS}
              onChange={setSearchBy}
              className={styles.fullWidth}
              disabled={searchMutation.isPending}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="check-in-search-query">SEARCH QUERY</label>

            <Input
              id="check-in-search-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Guest name, booking reference, email or phone..."
              disabled={searchMutation.isPending}
            />
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={searchMutation.isPending}
            disabled={!query.trim()}
          >
            Search
          </Button>
        </form>

        {searchMutation.isError && (
          <Alert
            type="error"
            showIcon
            className={styles.stateAlert}
            message="Booking search failed."
            description={
              searchMutation.error instanceof Error
                ? searchMutation.error.message
                : "Please try again."
            }
          />
        )}

        {hasSearched &&
          !searchMutation.isPending &&
          !searchMutation.isError &&
          searchResults.length === 0 && (
            <div className={styles.emptySearch}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No confirmed booking matched this search."
              />
            </div>
          )}

        {searchResults.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Guest Name</th>
                  <th>Ref #</th>
                  <th>Room Type</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                  <th />
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

                          <span>{booking.email ?? "No email"}</span>
                        </div>
                      </td>

                      <td className={styles.mono}>
                        {booking.bookingReference}
                      </td>

                      <td>{booking.roomType}</td>

                      <td>{formatDate(booking.checkInDate)}</td>

                      <td>{formatDate(booking.checkOutDate)}</td>

                      <td>
                        <span className={styles.confirmedBadge}>
                          ● Confirmed
                        </span>
                      </td>

                      <td>
                        <Button
                          type="primary"
                          size="small"
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

      <div className={styles.middleGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>STEP 2 — ID VERIFICATION</div>

          {!selectedBooking ? (
            <div className={styles.placeholderState}>
              Select a confirmed booking first.
            </div>
          ) : (
            <div className={styles.cardBody}>
              <div className={styles.bookingSummary}>
                <SummaryItem
                  label="GUEST"
                  value={selectedBooking.guestName ?? "Unavailable"}
                />

                <SummaryItem
                  label="REF"
                  value={selectedBooking.bookingReference}
                  mono
                />

                <SummaryItem label="NIGHTS" value={String(nights)} mono />
              </div>

              <div className={styles.field}>
                <label htmlFor="check-in-document-type">ID TYPE</label>

                <Select<IdentityDocumentType>
                  id="check-in-document-type"
                  value={documentType}
                  options={DOCUMENT_TYPE_OPTIONS}
                  onChange={setDocumentType}
                  className={styles.fullWidth}
                  disabled={checkInMutation.isPending || Boolean(checkInResult)}
                />
              </div>

              <Alert
                type="info"
                showIcon
                message="The current backend records document type and verification method. It does not accept an ID-number field."
              />

              <Checkbox
                checked={physicalDocumentVerified}
                onChange={(event) => {
                  setPhysicalDocumentVerified(event.target.checked);

                  if (!event.target.checked) {
                    setSelectedRoomNumber(undefined);
                  }
                }}
                disabled={checkInMutation.isPending || Boolean(checkInResult)}
              >
                Physical document verified at desk — mark complete
              </Checkbox>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>STEP 3 — ROOM ASSIGNMENT</div>

          {!selectedBooking ? (
            <div className={styles.placeholderState}>
              Select a confirmed booking first.
            </div>
          ) : !physicalDocumentVerified ? (
            <div className={styles.placeholderState}>
              Complete identity verification before assigning a room.
            </div>
          ) : roomsError ? (
            <div className={styles.cardBody}>
              <Alert
                type="error"
                showIcon
                message="Unable to load room availability."
              />
            </div>
          ) : roomsLoading ? (
            <div className={styles.loadingState}>
              <Spin size="small" />

              <span>Loading available rooms...</span>
            </div>
          ) : compatibleRooms.length === 0 ? (
            <div className={styles.cardBody}>
              <Alert
                type="warning"
                showIcon
                message={`No vacant ${selectedBooking.roomType} rooms are currently available.`}
              />
            </div>
          ) : (
            <div className={styles.cardBody}>
              <div className={styles.roomSectionTitle}>
                AVAILABLE ROOMS — {selectedBooking.roomType.toUpperCase()}
              </div>

              <div className={styles.roomTable}>
                <div className={styles.roomTableHeader}>
                  <span>ROOM</span>
                  <span>FLOOR</span>
                  <span>TYPE</span>
                  <span />
                </div>

                {compatibleRooms.map((room) => (
                  <RoomRow
                    key={room.roomNumber}
                    room={room}
                    selected={selectedRoomNumber === room.roomNumber}
                    disabled={
                      checkInMutation.isPending || Boolean(checkInResult)
                    }
                    onSelect={() => setSelectedRoomNumber(room.roomNumber)}
                  />
                ))}
              </div>

              <Alert
                type="info"
                showIcon
                message="After confirmation, the assigned room becomes Occupied and FOSS activation is attempted automatically."
              />
            </div>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>STEP 4 — CONFIRM CHECK-IN</div>

        {!selectedBooking ? (
          <div className={styles.placeholderState}>
            Complete the previous steps to confirm check-in.
          </div>
        ) : (
          <div className={styles.confirmBody}>
            <div className={styles.confirmSummary}>
              <SummaryItem
                label="GUEST"
                value={selectedBooking.guestName ?? "Unavailable"}
              />

              <SummaryItem
                label="ROOM"
                value={
                  checkInResult?.roomNumber ??
                  selectedRoomNumber ??
                  "Not assigned"
                }
                mono
              />

              <SummaryItem label="TYPE" value={selectedBooking.roomType} />

              <SummaryItem
                label="CHECK-IN"
                value={formatDate(selectedBooking.checkInDate, false)}
                mono
              />

              <SummaryItem
                label="CHECK-OUT"
                value={formatDate(selectedBooking.checkOutDate, false)}
                mono
              />

              <div
                className={`${styles.summaryItem} ${
                  physicalDocumentVerified ? styles.verifiedSummary : ""
                }`}
              >
                <span>ID VERIFIED</span>

                <strong>{physicalDocumentVerified ? "✓ Yes" : "No"}</strong>
              </div>
            </div>

            {!performedBy && !checkInResult && (
              <Alert
                type="warning"
                showIcon
                message="Check-in submission is waiting for authenticated receptionist identity integration."
                description="The backend requires verifiedBy to match the authenticated Front Desk receptionist. No UUID is hardcoded in the frontend."
              />
            )}

            {validationError && (
              <Alert type="error" showIcon message={validationError} />
            )}

            {checkInMutation.isError && (
              <Alert
                type="error"
                showIcon
                message="Guest check-in could not be completed."
                description={
                  checkInMutation.error instanceof Error
                    ? checkInMutation.error.message
                    : "Please try again."
                }
              />
            )}

            {checkInResult && (
              <>
                <Alert
                  type="success"
                  showIcon
                  message={`Check-in completed. Room ${checkInResult.roomNumber} is now occupied.`}
                />

                {checkInResult.fossSession.status === "ACTIVATED" ? (
                  <Alert
                    type="success"
                    showIcon
                    message="FOSS guest session activated."
                    description={`Valid until ${formatDate(
                      checkInResult.fossSession.validUntilDate,
                    )}.`}
                  />
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    message="Check-in succeeded, but FOSS activation failed."
                    description="The hotel check-in transaction has already been committed."
                  />
                )}
              </>
            )}

            {printMutation.isError && (
              <Alert
                type="error"
                showIcon
                message="Registration-card print request failed."
                description={
                  printMutation.error instanceof Error
                    ? printMutation.error.message
                    : "Please try again."
                }
              />
            )}

            {printMutation.isSuccess && (
              <Alert
                type="success"
                showIcon
                message="Registration-card print request accepted."
                description={`Print job: ${printMutation.data.printJobReference}`}
              />
            )}

            <div className={styles.confirmActions}>
              <Button
                disabled={!checkInResult}
                loading={printMutation.isPending}
                onClick={() => void handlePrintRegistrationCard()}
              >
                Print Registration Card
              </Button>

              <Button
                type="primary"
                className={styles.confirmButton}
                loading={checkInMutation.isPending}
                disabled={
                  Boolean(checkInResult) ||
                  !selectedBooking ||
                  !physicalDocumentVerified ||
                  !selectedRoomNumber ||
                  !performedBy
                }
                onClick={() => void handleCheckIn()}
              >
                Confirm Check-In & Activate FOSS →
              </Button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

type StepItemProps = {
  step: number;
  label: string;
  activeStep: number;
};

function StepItem({ step, label, activeStep }: StepItemProps) {
  const completed = activeStep > step;

  const active = activeStep === step;

  return (
    <div
      className={`${styles.stepItem} ${
        completed ? styles.stepCompleted : active ? styles.stepActive : ""
      }`}
    >
      <span className={styles.stepCircle}>{completed ? "✓" : step}</span>

      <span>{label}</span>
    </div>
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

type RoomRowProps = {
  room: RoomStatusBoardItem;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function RoomRow({ room, selected, disabled, onSelect }: RoomRowProps) {
  return (
    <div className={`${styles.roomRow} ${selected ? styles.selectedRoom : ""}`}>
      <span className={styles.mono}>{room.roomNumber}</span>

      <span>{room.floor}</span>

      <span>{room.roomTypeName}</span>

      <Button
        type={selected ? "primary" : "default"}
        size="small"
        disabled={disabled}
        onClick={onSelect}
      >
        {selected ? "Assigned" : "Assign"}
      </Button>
    </div>
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

  const normalized = query.toLowerCase();

  return bookings.filter((booking) => {
    switch (field) {
      case "booking":
        return booking.bookingReference.toLowerCase().includes(normalized);

      case "guest":
        return (booking.guestName ?? "").toLowerCase().includes(normalized);

      case "email":
        return (booking.email ?? "").toLowerCase().includes(normalized);

      case "phone":
        return (booking.phone ?? "").toLowerCase().includes(normalized);

      default:
        return true;
    }
  });
}

function formatDate(value: string, includeYear = true) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(includeYear
      ? {
          year: "numeric",
        }
      : {}),
  }).format(date);
}
