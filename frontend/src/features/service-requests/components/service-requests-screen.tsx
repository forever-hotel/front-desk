"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Alert, Button, Input, Select } from "antd";
import { ConciergeBell } from "lucide-react";

import {
  useSearchBookings,
  type BookingSearchItem,
} from "@/features/reservations";

import { useCreateServiceRequest } from "../hooks/use-create-service-request";
import { getLocalDevelopmentReceptionistId } from "../lib/development-actor";
import type { ServiceRequestCategory } from "../types/service-request.type";

import styles from "./service-requests-screen.module.css";

const categoryOptions: Array<{
  value: ServiceRequestCategory;
  label: string;
}> = [
  { value: "EXTRA_TOWELS", label: "Extra towels" },
  { value: "WATER_BOTTLES", label: "Water bottles" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "LAUNDRY", label: "Laundry" },
  { value: "OTHER", label: "Other service" },
];

type ServiceRequestsScreenProps = {
  /** Auth Service/session-provided receptionist ID, when available. */
  performedBy?: string;
};

export function ServiceRequestsScreen({
  performedBy,
}: ServiceRequestsScreenProps) {
  const [developmentActorId, setDevelopmentActorId] = useState<string | null>(
    null,
  );
  const [searchText, setSearchText] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [bookings, setBookings] = useState<BookingSearchItem[]>([]);
  const [selectedBooking, setSelectedBooking] =
    useState<BookingSearchItem | null>(null);
  const [category, setCategory] =
    useState<ServiceRequestCategory>("EXTRA_TOWELS");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const bookingSearch = useSearchBookings();
  const createRequest = useCreateServiceRequest();
  const actorId = performedBy ?? developmentActorId;

  useEffect(() => {
    // Development-only bridge. NOT a verified production session.
    const timer = window.setTimeout(() => {
      setDevelopmentActorId(getLocalDevelopmentReceptionistId());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = searchText.trim();
    if (!normalized || bookingSearch.isPending || createRequest.isPending) {
      return;
    }

    setHasSearched(true);
    setSelectedBooking(null);
    setBookings([]);
    setValidationError(null);
    createRequest.reset();

    try {
      const results = await bookingSearch.mutateAsync(normalized);
      setBookings(
        results.filter(
          (booking) => booking.status.toUpperCase() === "CHECKED_IN",
        ),
      );
    } catch {
      setBookings([]);
      // Detailed API error is shown below via bookingSearch.error.
    }
  }

  function chooseBooking(booking: BookingSearchItem) {
    setSelectedBooking(booking);
    setValidationError(null);
    createRequest.reset();
  }

  async function handleSubmit() {
    if (createRequest.isPending || createRequest.isSuccess) {
      return;
    }

    setValidationError(null);

    if (
      !selectedBooking ||
      selectedBooking.status.toUpperCase() !== "CHECKED_IN"
    ) {
      setValidationError("Select a checked-in booking first.");
      return;
    }

    if (!actorId) {
      setValidationError(
        "An authenticated receptionist session is required to submit a service request.",
      );
      return;
    }

    const cleanDescription = description.trim();
    if (cleanDescription.length > 300) {
      setValidationError("Description must not exceed 300 characters.");
      return;
    }

    try {
      await createRequest.mutateAsync({
        bookingReference: selectedBooking.bookingReference,
        category,
        description: cleanDescription || undefined,
        performedBy: actorId,
      });
    } catch {
      // Backend error is shown through createRequest.error.
    }
  }

  function resetForNewRequest() {
    setSelectedBooking(null);
    setSearchText("");
    setHasSearched(false);
    setBookings([]);
    setCategory("EXTRA_TOWELS");
    setDescription("");
    setValidationError(null);
    bookingSearch.reset();
    createRequest.reset();
  }

  const result = createRequest.data;

  return (
    <section className={styles.page} aria-labelledby="service-requests-heading">
      <header className={styles.pageHeader}>
        <ConciergeBell size={21} aria-hidden="true" />
        <div>
          <h1 id="service-requests-heading">Guest Service Requests</h1>
          <p>
            Create a service task for a guest with an active checked-in stay.
          </p>
        </div>
      </header>

      <section
        className={styles.card}
        aria-labelledby="service-booking-heading"
      >
        <h2 className={styles.cardTitle} id="service-booking-heading">
          STEP 1 — FIND A CHECKED-IN BOOKING
        </h2>
        <div className={styles.cardBody}>
          <form
            className={styles.searchForm}
            onSubmit={(event) => void handleSearch(event)}
          >
            <div className={styles.field}>
              <label htmlFor="service-booking-search">
                Find a checked-in booking
              </label>
              <Input
                id="service-booking-search"
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setHasSearched(false);
                  setBookings([]);
                  setSelectedBooking(null);
                  setValidationError(null);
                  bookingSearch.reset();
                  createRequest.reset();
                }}
                placeholder="Guest name, email or booking reference"
                disabled={bookingSearch.isPending || createRequest.isPending}
              />
            </div>
            <Button
              type="primary"
              htmlType="submit"
              loading={bookingSearch.isPending}
              disabled={!searchText.trim() || createRequest.isPending}
            >
              Search booking
            </Button>
          </form>

          {bookingSearch.isError && (
            <div role="alert">
              <Alert
                type="error"
                showIcon
                title="Booking search failed"
                description={bookingSearch.error.message}
              />
            </div>
          )}

          {hasSearched &&
            !bookingSearch.isPending &&
            !bookingSearch.isError &&
            bookings.length === 0 && (
              <p role="status" className={styles.infoText}>
                No checked-in bookings matched this search.
              </p>
            )}

          {bookings.length > 0 && (
            <div className={styles.results} aria-label="Checked-in bookings">
              {bookings.map((booking) => (
                <div
                  className={styles.bookingRow}
                  key={booking.bookingReference}
                >
                  <div className={styles.bookingDetail}>
                    <strong>
                      {booking.guestName || "Guest name unavailable"}
                    </strong>
                    <span>Reference: {booking.bookingReference}</span>
                    <span>Booking status: Checked in</span>
                  </div>
                  <Button
                    onClick={() => chooseBooking(booking)}
                    disabled={createRequest.isPending}
                    aria-label={`Select booking for ${booking.guestName || booking.bookingReference}`}
                    type={
                      selectedBooking?.bookingReference ===
                      booking.bookingReference
                        ? "primary"
                        : "default"
                    }
                  >
                    {selectedBooking?.bookingReference ===
                    booking.bookingReference
                      ? "Selected"
                      : "Select"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedBooking && (
            <div className={styles.selected} role="status">
              Selected: {selectedBooking.guestName || "Guest"} —{" "}
              {selectedBooking.bookingReference}
            </div>
          )}
        </div>
      </section>

      <section
        className={styles.card}
        aria-labelledby="service-details-heading"
      >
        <h2 className={styles.cardTitle} id="service-details-heading">
          STEP 2 — SERVICE DETAILS
        </h2>
        <div className={styles.cardBody}>
          <div className={styles.field}>
            <label htmlFor="service-request-category">Service category</label>
            <Select<ServiceRequestCategory>
              id="service-request-category"
              className={styles.fullWidth}
              value={category}
              onChange={(value) => {
                setCategory(value);
                createRequest.reset();
              }}
              options={categoryOptions}
              disabled={createRequest.isPending || createRequest.isSuccess}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="service-request-description">
              Description (optional)
            </label>
            <Input.TextArea
              id="service-request-description"
              rows={3}
              maxLength={300}
              showCount
              value={description}
              placeholder="Additional information for the worker"
              onChange={(event) => {
                setDescription(event.target.value);
                createRequest.reset();
              }}
              disabled={createRequest.isPending || createRequest.isSuccess}
            />
          </div>

          <p className={styles.infoText}>
            The backend checks the booking status and determines the room
            number. The request is forwarded to WKMS only when the integration
            is available.
          </p>

          {!actorId && (
            <div role="status">
              <Alert
                type="warning"
                showIcon
                title="Authenticated receptionist identity is required"
                description="Submission remains unavailable until a receptionist session is provided. Local development may use a valid temporary RECEPTIONIST JWT; a MANAGER token is read-only for this operation."
              />
            </div>
          )}

          {validationError && (
            <p role="alert" className={styles.errorText}>
              {validationError}
            </p>
          )}

          {createRequest.isError && (
            <div role="alert">
              <Alert
                type="error"
                showIcon
                title="Service request could not be created"
                description={createRequest.error.message}
              />
            </div>
          )}

          {result && (
            <div role="status" aria-live="polite">
              <Alert
                type="success"
                showIcon
                title="Service request created"
                description={
                  <div className={styles.resultDetails}>
                    <span>Room: {result.roomNumber}</span>
                    <span>Task reference: {result.task.taskId}</span>
                    <span>Task status: {result.task.status}</span>
                  </div>
                }
              />
            </div>
          )}

          <div className={styles.actions}>
            {result && (
              <Button onClick={resetForNewRequest}>New service request</Button>
            )}
            <Button
              type="primary"
              loading={createRequest.isPending}
              disabled={
                !selectedBooking ||
                !actorId ||
                bookingSearch.isPending ||
                createRequest.isSuccess
              }
              onClick={() => void handleSubmit()}
            >
              Create service request
            </Button>
          </div>
        </div>
      </section>
    </section>
  );
}
