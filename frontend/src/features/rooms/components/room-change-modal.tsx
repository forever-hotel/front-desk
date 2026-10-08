"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Alert, Button, Empty, Input, Modal, Select, Spin } from "antd";

import { Search } from "lucide-react";

import {
  useSearchBookings,
  type BookingSearchItem,
} from "@/features/reservations";

import { useAvailableRoomChanges } from "../hooks/use-available-room-changes";
import { useCreateRoomChange } from "../hooks/use-create-room-change";

import type { RoomChangeResult } from "../types/room-change.type";

import styles from "./room-change-modal.module.css";

type RoomChangeModalProps = {
  open: boolean;
  onClose: () => void;

  /*
   * This must eventually come from the real authenticated
   * Front Desk principal/session. Do not hardcode a staff UUID.
   */
  performedBy?: string;

  onCompleted?: (result: RoomChangeResult) => void;
};

export function RoomChangeModal({
  open,
  onClose,
  performedBy,
  onCompleted,
}: RoomChangeModalProps) {
  const [query, setQuery] = useState("");

  const [searchResults, setSearchResults] = useState<BookingSearchItem[]>([]);

  const [hasSearched, setHasSearched] = useState(false);

  const [selectedBooking, setSelectedBooking] =
    useState<BookingSearchItem | null>(null);

  const [targetRoomNumber, setTargetRoomNumber] = useState<string>();

  const [reason, setReason] = useState("");

  const searchMutation = useSearchBookings();

  const availableRoomsQuery = useAvailableRoomChanges(
    selectedBooking?.bookingReference ?? null,
  );

  const roomChangeMutation = useCreateRoomChange();

  const resetModal = () => {
    setQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setSelectedBooking(null);
    setTargetRoomNumber(undefined);
    setReason("");

    searchMutation.reset();
    roomChangeMutation.reset();
  };

  const handleClose = () => {
    if (roomChangeMutation.isPending) {
      return;
    }

    resetModal();
    onClose();
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    setHasSearched(true);
    setSelectedBooking(null);
    setTargetRoomNumber(undefined);

    searchMutation.reset();

    try {
      const results = await searchMutation.mutateAsync(normalizedQuery);

      setSearchResults(
        results.filter(
          (booking) => booking.status.toUpperCase() === "CHECKED_IN",
        ),
      );
    } catch {
      setSearchResults([]);
    }
  };

  const handleSelectBooking = (booking: BookingSearchItem) => {
    setSelectedBooking(booking);
    setTargetRoomNumber(undefined);
    roomChangeMutation.reset();
  };

  const handleConfirm = async () => {
    if (!selectedBooking || !targetRoomNumber || !performedBy) {
      return;
    }

    try {
      const result = await roomChangeMutation.mutateAsync({
        bookingReference: selectedBooking.bookingReference,

        targetRoomNumber,

        performedBy,

        reason: reason.trim() || undefined,
      });

      resetModal();

      onCompleted?.(result);

      onClose();
    } catch {
      /*
       * Mutation error is shown below.
       */
    }
  };

  const availableRooms = availableRoomsQuery.data ?? [];

  return (
    <Modal
      open={open}
      title="↔ Room Change"
      footer={null}
      width={520}
      centered
      onCancel={handleClose}
      closable={!roomChangeMutation.isPending}
      maskClosable={!roomChangeMutation.isPending}
      className={styles.modal}
    >
      <div className={styles.body}>
        <div className={styles.field}>
          <label htmlFor="room-change-search">CURRENT GUEST / BOOKING</label>

          <form className={styles.searchRow} onSubmit={handleSearch}>
            <Input
              id="room-change-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by guest name or booking reference..."
              disabled={searchMutation.isPending}
              prefix={<Search size={14} aria-hidden="true" />}
            />

            <Button
              type="primary"
              htmlType="submit"
              loading={searchMutation.isPending}
              disabled={!query.trim()}
            >
              Search
            </Button>
          </form>
        </div>

        {searchMutation.isError && (
          <Alert
            type="error"
            showIcon
            message="Unable to search checked-in guests."
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
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No checked-in booking matched this search."
            />
          )}

        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map((booking) => {
              const selected = selectedBooking?.bookingId === booking.bookingId;

              return (
                <button
                  key={booking.bookingId}
                  type="button"
                  className={`${styles.bookingOption} ${
                    selected ? styles.selectedBooking : ""
                  }`}
                  onClick={() => handleSelectBooking(booking)}
                >
                  <span>
                    <strong>
                      {booking.guestName ?? "Guest name unavailable"}
                    </strong>

                    <small>{booking.bookingReference}</small>
                  </span>

                  <span className={styles.bookingMeta}>{booking.roomType}</span>
                </button>
              );
            })}
          </div>
        )}

        {selectedBooking && (
          <>
            <div className={styles.selectedSummary}>
              <div>
                <span>GUEST</span>

                <strong>
                  {selectedBooking.guestName ?? "Guest name unavailable"}
                </strong>
              </div>

              <div>
                <span>BOOKING REF</span>

                <strong>{selectedBooking.bookingReference}</strong>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="new-room">NEW ROOM (AVAILABLE ONLY)</label>

              {availableRoomsQuery.isLoading ? (
                <div className={styles.inlineLoading}>
                  <Spin size="small" />

                  <span>Loading available rooms...</span>
                </div>
              ) : availableRoomsQuery.isError ? (
                <Alert
                  type="error"
                  showIcon
                  message="Unable to load available rooms."
                  description={
                    availableRoomsQuery.error instanceof Error
                      ? availableRoomsQuery.error.message
                      : "Please try again."
                  }
                />
              ) : (
                <Select
                  id="new-room"
                  value={targetRoomNumber}
                  onChange={setTargetRoomNumber}
                  placeholder="— Select new room —"
                  className={styles.fullWidth}
                  disabled={availableRooms.length === 0}
                  options={availableRooms.map((room) => ({
                    value: room.roomNumber,

                    label: `${room.roomNumber} — ${room.roomTypeName} · Floor ${room.floor}`,
                  }))}
                />
              )}

              {!availableRoomsQuery.isLoading &&
                !availableRoomsQuery.isError &&
                availableRooms.length === 0 && (
                  <span className={styles.helper}>
                    No eligible vacant rooms are currently available.
                  </span>
                )}
            </div>

            <div className={styles.field}>
              <label htmlFor="room-change-reason">REASON FOR ROOM CHANGE</label>

              <Input
                id="room-change-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Guest request / upgrade / maintenance..."
                maxLength={500}
                disabled={roomChangeMutation.isPending}
              />
            </div>

            <Alert
              type="info"
              showIcon
              message="After confirmation, the previous room becomes Requires Cleaning and the new room becomes Occupied."
            />

            {!performedBy && (
              <Alert
                type="warning"
                showIcon
                message="Room-change confirmation is waiting for authenticated Front Desk staff identity integration."
                description="No staff UUID is hardcoded in the frontend."
              />
            )}

            {roomChangeMutation.isError && (
              <Alert
                type="error"
                showIcon
                message="Room change could not be completed."
                description={
                  roomChangeMutation.error instanceof Error
                    ? roomChangeMutation.error.message
                    : "Please try again."
                }
              />
            )}
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Button onClick={handleClose} disabled={roomChangeMutation.isPending}>
          Cancel
        </Button>

        <Button
          type="primary"
          loading={roomChangeMutation.isPending}
          disabled={!selectedBooking || !targetRoomNumber || !performedBy}
          onClick={() => void handleConfirm()}
        >
          Confirm Room Change
        </Button>
      </div>
    </Modal>
  );
}
