"use client";

import { useMemo, useState } from "react";

import { Alert, Button, Input, InputNumber, Select, Spin } from "antd";

import { Plus } from "lucide-react";

import { useRoomStatus, type RoomStatusBoardItem } from "@/features/rooms";

import { useCreateWalkInBooking } from "../hooks/use-create-walk-in-booking";

import type { WalkInPaymentMethod } from "../types/reservation.type";

import styles from "./walk-in-booking-screen.module.css";

type RoomTypeOption = {
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  vacantRooms: number;
};

export function WalkInBookingScreen() {
  const {
    data: rooms = [],
    isLoading: roomsLoading,
    error: roomsError,
  } = useRoomStatus();

  const createWalkInMutation = useCreateWalkInBooking();

  const [fullName, setFullName] = useState("");

  const [nicOrPassport, setNicOrPassport] = useState("");

  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");

  const [roomTypeId, setRoomTypeId] = useState<string>();

  const [numGuests, setNumGuests] = useState(1);

  const [checkInDate, setCheckInDate] = useState("");

  const [checkOutDate, setCheckOutDate] = useState("");

  const [specialRequests, setSpecialRequests] = useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<WalkInPaymentMethod>("CASH");

  const [validationError, setValidationError] = useState<string | null>(null);

  const roomTypes = useMemo(() => buildRoomTypeOptions(rooms), [rooms]);

  const selectedRoomType =
    roomTypes.find((roomType) => roomType.roomTypeId === roomTypeId) ?? null;

  const resetForm = () => {
    setFullName("");
    setNicOrPassport("");
    setPhone("");
    setEmail("");
    setRoomTypeId(undefined);
    setNumGuests(1);
    setCheckInDate("");
    setCheckOutDate("");
    setSpecialRequests("");
    setPaymentMethod("CASH");
    setValidationError(null);

    createWalkInMutation.reset();
  };

  const handleSubmit = async () => {
    setValidationError(null);

    const normalizedName = fullName.trim();

    const normalizedEmail = email.trim();

    if (!normalizedName) {
      setValidationError("Guest full name is required.");

      return;
    }

    if (!normalizedEmail) {
      setValidationError("Guest email is required.");

      return;
    }

    if (!roomTypeId) {
      setValidationError("Please select a room type.");

      return;
    }

    if (!Number.isInteger(numGuests) || numGuests < 1) {
      setValidationError("Number of guests must be at least 1.");

      return;
    }

    if (!checkInDate || !checkOutDate) {
      setValidationError("Check-in and check-out dates are required.");

      return;
    }

    const checkIn = new Date(`${checkInDate}T00:00:00`);

    const checkOut = new Date(`${checkOutDate}T00:00:00`);

    if (
      !Number.isFinite(checkIn.getTime()) ||
      !Number.isFinite(checkOut.getTime()) ||
      checkOut <= checkIn
    ) {
      setValidationError("Check-out date must be after check-in date.");

      return;
    }

    try {
      await createWalkInMutation.mutateAsync({
        guest: {
          fullName: normalizedName,
          email: normalizedEmail,

          nicOrPassport: nicOrPassport.trim() || undefined,

          phone: phone.trim() || undefined,
        },

        booking: {
          roomTypeId,
          checkInDate,
          checkOutDate,
          numGuests,

          specialRequests: specialRequests.trim() || undefined,
        },

        payment: {
          paymentMethod,
        },
      });
    } catch {
      /*
       * Backend validation/error is
       * rendered below.
       */
    }
  };

  const result = createWalkInMutation.data;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />

          <div>
            <h1>Walk-In Booking</h1>

            <p>Create a booking for a walk-in guest</p>
          </div>
        </div>
      </header>

      {result && (
        <Alert
          type="success"
          showIcon
          className={styles.feedback}
          message="Walk-in booking created successfully."
          description={
            <div className={styles.successDetails}>
              <span>
                Booking reference: <strong>{result.bookingReference}</strong>
              </span>

              <span>
                Status: <strong>{result.status}</strong>
              </span>

              <span>
                Total: <strong>{formatMoney(result.totalAmount)}</strong>
              </span>

              <span>
                Payment: <strong>{result.payment.paymentStatus}</strong>
              </span>
            </div>
          }
          action={
            <Button size="small" onClick={resetForm}>
              New Booking
            </Button>
          }
        />
      )}

      <div className={styles.layout}>
        <div className={styles.leftColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>GUEST DETAILS</div>

            <div className={styles.cardBody}>
              <div className={styles.twoColumnGrid}>
                <FormField label="FULL NAME" htmlFor="walk-in-name">
                  <Input
                    id="walk-in-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Guest full name"
                    maxLength={255}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>

                <FormField label="NIC / PASSPORT NO." htmlFor="walk-in-id">
                  <Input
                    id="walk-in-id"
                    value={nicOrPassport}
                    onChange={(event) => setNicOrPassport(event.target.value)}
                    placeholder="ID number"
                    maxLength={50}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>

                <FormField label="PHONE" htmlFor="walk-in-phone">
                  <Input
                    id="walk-in-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+94 7x xxx xxxx"
                    maxLength={20}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>

                <FormField label="EMAIL" htmlFor="walk-in-email">
                  <Input
                    id="walk-in-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="guest@email.com"
                    maxLength={320}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>
              </div>

              <Alert
                type="info"
                showIcon
                message="Guest ID verification is completed during the Check-In workflow."
              />
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>BOOKING DETAILS</div>

            <div className={styles.cardBody}>
              <div className={styles.twoColumnGrid}>
                <FormField label="ROOM TYPE" htmlFor="walk-in-room-type">
                  <Select
                    id="walk-in-room-type"
                    value={roomTypeId}
                    onChange={setRoomTypeId}
                    placeholder="— Select room type —"
                    className={styles.fullWidth}
                    loading={roomsLoading}
                    disabled={roomsLoading || createWalkInMutation.isPending}
                    options={roomTypes.map((roomType) => ({
                      value: roomType.roomTypeId,

                      label: roomType.roomTypeName,
                    }))}
                  />
                </FormField>

                <FormField label="NO. OF GUESTS" htmlFor="walk-in-guests">
                  <InputNumber
                    id="walk-in-guests"
                    min={1}
                    precision={0}
                    value={numGuests}
                    onChange={(value) => setNumGuests(value ?? 1)}
                    className={styles.fullWidth}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>

                <FormField label="CHECK-IN DATE" htmlFor="walk-in-check-in">
                  <Input
                    id="walk-in-check-in"
                    type="date"
                    value={checkInDate}
                    onChange={(event) => setCheckInDate(event.target.value)}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>

                <FormField label="CHECK-OUT DATE" htmlFor="walk-in-check-out">
                  <Input
                    id="walk-in-check-out"
                    type="date"
                    value={checkOutDate}
                    onChange={(event) => setCheckOutDate(event.target.value)}
                    disabled={createWalkInMutation.isPending}
                  />
                </FormField>
              </div>

              <FormField label="SPECIAL REQUESTS" htmlFor="walk-in-special">
                <Input
                  id="walk-in-special"
                  value={specialRequests}
                  onChange={(event) => setSpecialRequests(event.target.value)}
                  placeholder="Optional..."
                  disabled={createWalkInMutation.isPending}
                />
              </FormField>
            </div>
          </section>
        </div>

        <div className={styles.rightColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              ROOM TYPES — CURRENT INVENTORY
            </div>

            {roomsError ? (
              <div className={styles.cardBody}>
                <Alert
                  type="error"
                  showIcon
                  message="Unable to load room inventory."
                />
              </div>
            ) : roomsLoading ? (
              <div className={styles.loadingState}>
                <Spin size="small" />

                <span>Loading room types...</span>
              </div>
            ) : roomTypes.length === 0 ? (
              <div className={styles.emptyState}>
                No room types were returned.
              </div>
            ) : (
              <div className={styles.roomTypeList}>
                {roomTypes.map((roomType) => (
                  <div
                    key={roomType.roomTypeId}
                    className={`${styles.roomTypeRow} ${
                      roomTypeId === roomType.roomTypeId
                        ? styles.selectedRoomType
                        : ""
                    }`}
                  >
                    <div>
                      <strong>{roomType.roomTypeName}</strong>

                      <span>
                        {roomType.vacantRooms} vacant now /{" "}
                        {roomType.totalRooms} total
                      </span>
                    </div>

                    <Button
                      type={
                        roomTypeId === roomType.roomTypeId
                          ? "primary"
                          : "default"
                      }
                      size="small"
                      onClick={() => setRoomTypeId(roomType.roomTypeId)}
                      disabled={createWalkInMutation.isPending}
                    >
                      {roomTypeId === roomType.roomTypeId
                        ? "Selected"
                        : "Select"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>PAYMENT</div>

            <div className={styles.cardBody}>
              <div className={styles.paymentSummary}>
                <div>
                  <span>ROOM TYPE</span>

                  <strong>
                    {selectedRoomType?.roomTypeName ?? "Not selected"}
                  </strong>
                </div>

                <div>
                  <span>VACANT NOW</span>

                  <strong>
                    {selectedRoomType ? selectedRoomType.vacantRooms : "—"}
                  </strong>
                </div>
              </div>

              <FormField label="PAYMENT METHOD" htmlFor="walk-in-payment">
                <Select<WalkInPaymentMethod>
                  id="walk-in-payment"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  className={styles.fullWidth}
                  disabled={createWalkInMutation.isPending}
                  options={[
                    {
                      value: "CASH",
                      label: "Cash",
                    },
                    {
                      value: "CARD_ON_SITE",
                      label: "Card on site",
                    },
                  ]}
                />
              </FormField>

              <Alert
                type="info"
                showIcon
                message="Room assignment, ID verification and FOSS activation are completed during Check-In."
              />

              <Alert
                type="info"
                showIcon
                message="The backend calculates the final booking total after submission."
              />

              {validationError && (
                <Alert type="error" showIcon message={validationError} />
              )}

              {createWalkInMutation.isError && (
                <Alert
                  type="error"
                  showIcon
                  message="Walk-in booking could not be created."
                  description={
                    createWalkInMutation.error instanceof Error
                      ? createWalkInMutation.error.message
                      : "Please try again."
                  }
                />
              )}

              <Button
                type="primary"
                block
                className={styles.confirmButton}
                loading={createWalkInMutation.isPending}
                disabled={roomsLoading || Boolean(result)}
                onClick={() => void handleSubmit()}
              >
                Create Walk-In Booking →
              </Button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

type FormFieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
};

function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>{label}</label>

      {children}
    </div>
  );
}

function buildRoomTypeOptions(rooms: RoomStatusBoardItem[]): RoomTypeOption[] {
  const roomTypes = new Map<string, RoomTypeOption>();

  for (const room of rooms) {
    const existing = roomTypes.get(room.roomTypeId);

    if (existing) {
      existing.totalRooms += 1;

      if (room.status === "VACANT") {
        existing.vacantRooms += 1;
      }

      continue;
    }

    roomTypes.set(room.roomTypeId, {
      roomTypeId: room.roomTypeId,

      roomTypeName: room.roomTypeName,

      totalRooms: 1,

      vacantRooms: room.status === "VACANT" ? 1 : 0,
    });
  }

  return Array.from(roomTypes.values()).sort((left, right) =>
    left.roomTypeName.localeCompare(right.roomTypeName),
  );
}

function formatMoney(amount: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}
