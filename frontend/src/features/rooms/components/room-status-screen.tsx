"use client";

import { useMemo, useState } from "react";

import { Alert, Button, Input, Modal, Select, Spin } from "antd";

import { ArrowLeftRight, LayoutGrid } from "lucide-react";

import { useRealtimeStatus } from "@/hooks/use-realtime-status";

import type { RoomStatus } from "@/types/room-status.type";

import { useRoomStatus } from "../hooks/use-room-status";
import { useUpdateRoomStatus } from "../hooks/use-update-room-status";

import type { RoomStatusBoardItem } from "../types/room.type";

import { RoomChangeModal } from "./room-change-modal";

import styles from "./room-status-screen.module.css";

const STATUS_LABELS: Record<RoomStatus, string> = {
  VACANT: "VACANT",
  OCCUPIED: "OCCUPIED",
  REQUIRES_CLEANING: "CLEANING",
  UNDER_MAINTENANCE: "MAINT.",
};

export function RoomStatusScreen() {
  const { data: rooms = [], isLoading, error } = useRoomStatus();

  const { connectionState } = useRealtimeStatus();

  const updateRoomStatusMutation = useUpdateRoomStatus();

  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const [roomChangeOpen, setRoomChangeOpen] = useState(false);

  const [maintenanceRoom, setMaintenanceRoom] = useState<string>();

  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const roomsByFloor = useMemo(() => {
    const grouped = new Map<number, RoomStatusBoardItem[]>();

    for (const room of rooms) {
      const existing = grouped.get(room.floor) ?? [];

      existing.push(room);

      grouped.set(room.floor, existing);
    }

    return Array.from(grouped.entries())
      .sort(([leftFloor], [rightFloor]) => leftFloor - rightFloor)
      .map(([floor, floorRooms]) => ({
        floor,

        rooms: [...floorRooms].sort((left, right) =>
          left.roomNumber.localeCompare(right.roomNumber, undefined, {
            numeric: true,
          }),
        ),

        roomTypes: Array.from(
          new Set(floorRooms.map((room) => room.roomTypeName)),
        ),
      }));
  }, [rooms]);

  const vacantRooms = useMemo(
    () =>
      rooms
        .filter((room) => room.status === "VACANT")
        .sort((left, right) =>
          left.roomNumber.localeCompare(right.roomNumber, undefined, {
            numeric: true,
          }),
        ),
    [rooms],
  );

  const openMaintenanceModal = () => {
    setSuccessMessage(null);

    updateRoomStatusMutation.reset();

    setMaintenanceRoom(undefined);

    setMaintenanceNotes("");

    setMaintenanceOpen(true);
  };

  const closeMaintenanceModal = () => {
    if (updateRoomStatusMutation.isPending) {
      return;
    }

    setMaintenanceOpen(false);

    setMaintenanceRoom(undefined);

    setMaintenanceNotes("");

    updateRoomStatusMutation.reset();
  };

  const handleMaintenanceSubmit = async () => {
    if (!maintenanceRoom) {
      return;
    }

    try {
      await updateRoomStatusMutation.mutateAsync({
        roomNumber: maintenanceRoom,

        payload: {
          targetStatus: "UNDER_MAINTENANCE",

          notes: maintenanceNotes.trim() || undefined,
        },
      });

      setSuccessMessage(
        `Room ${maintenanceRoom} was marked under maintenance.`,
      );

      setMaintenanceOpen(false);

      setMaintenanceRoom(undefined);

      setMaintenanceNotes("");
    } catch {
      /*
       * Mutation error is displayed
       * inside the modal.
       */
    }
  };

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.titleRow}>
            <LayoutGrid size={17} strokeWidth={2} aria-hidden="true" />

            <h1>Room Status Board</h1>
          </div>

          <p>Real-time room state — all floors</p>
        </div>

        <div className={styles.headerActions}>
          <div
            className={`${styles.connectionBadge} ${styles[connectionState]}`}
            role="status"
            aria-live="polite"
          >
            <span className={styles.connectionDot} aria-hidden="true" />

            {connectionState === "connected"
              ? "LIVE"
              : connectionState === "connecting"
                ? "RECONNECTING"
                : "REST FALLBACK"}
          </div>

          <Button
            icon={<ArrowLeftRight size={14} />}
            onClick={() => setRoomChangeOpen(true)}
          >
            Room Change
          </Button>

          <Button
            danger
            type="primary"
            onClick={openMaintenanceModal}
            disabled={isLoading || vacantRooms.length === 0}
          >
            Mark Maintenance
          </Button>
        </div>
      </header>

      {successMessage && (
        <Alert
          type="success"
          showIcon
          closable
          message={successMessage}
          className={styles.feedback}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          message="Unable to load the room-status board."
          description="Please try again."
          className={styles.feedback}
        />
      )}

      {isLoading ? (
        <div className={styles.loadingState} role="status">
          <Spin />

          <span>Loading room status...</span>
        </div>
      ) : rooms.length === 0 ? (
        <div className={styles.emptyState}>No rooms were returned.</div>
      ) : (
        <div className={styles.floorList}>
          {roomsByFloor.map(({ floor, rooms: floorRooms, roomTypes }) => (
            <section key={floor} className={styles.floorCard}>
              <div className={styles.floorHeader}>
                <span>
                  FLOOR {floor}
                  {roomTypes.length > 0
                    ? ` — ${roomTypes
                        .map((roomType) => roomType.toUpperCase())
                        .join(" & ")}`
                    : ""}
                </span>

                <span>{floorRooms.length} rooms</span>
              </div>

              <div className={styles.roomGrid}>
                {floorRooms.map((room) => (
                  <article
                    key={room.roomNumber}
                    className={`${styles.roomCard} ${
                      styles[room.status.toLowerCase()]
                    }`}
                  >
                    <strong className={styles.roomNumber}>
                      {room.roomNumber}
                    </strong>

                    <span className={styles.roomStatus}>
                      {STATUS_LABELS[room.status]}
                    </span>

                    <span className={styles.roomType}>{room.roomTypeName}</span>
                  </article>
                ))}
              </div>

              {floor === roomsByFloor[0]?.floor && (
                <div className={styles.legend}>
                  <LegendItem
                    className={styles.legendVacant}
                    label="Vacant / Clean"
                  />

                  <LegendItem
                    className={styles.legendOccupied}
                    label="Occupied"
                  />

                  <LegendItem
                    className={styles.legendCleaning}
                    label="Requires Cleaning"
                  />

                  <LegendItem
                    className={styles.legendMaintenance}
                    label="Under Maintenance"
                  />
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal
        open={maintenanceOpen}
        title="Mark Under Maintenance"
        onCancel={closeMaintenanceModal}
        footer={null}
        centered
        width={500}
        closable={!updateRoomStatusMutation.isPending}
        maskClosable={!updateRoomStatusMutation.isPending}
        className={styles.maintenanceModal}
      >
        <div className={styles.modalBody}>
          <div className={styles.formField}>
            <label htmlFor="maintenance-room">ROOM NUMBER</label>

            <Select
              id="maintenance-room"
              value={maintenanceRoom}
              onChange={setMaintenanceRoom}
              placeholder="— Select room —"
              className={styles.fullWidth}
              options={vacantRooms.map((room) => ({
                value: room.roomNumber,

                label: `${room.roomNumber} — ${room.roomTypeName}`,
              }))}
              disabled={updateRoomStatusMutation.isPending}
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="maintenance-notes">
              MAINTENANCE REASON / NOTES
            </label>

            <Input.TextArea
              id="maintenance-notes"
              value={maintenanceNotes}
              onChange={(event) => setMaintenanceNotes(event.target.value)}
              placeholder="Describe the maintenance issue..."
              rows={4}
              maxLength={500}
              disabled={updateRoomStatusMutation.isPending}
            />
          </div>

          <Alert
            type="warning"
            showIcon
            message="This room will be blocked from guest allocation until it is cleared by a receptionist."
          />

          {updateRoomStatusMutation.isError && (
            <Alert
              type="error"
              showIcon
              message="Unable to mark this room under maintenance."
              description={
                updateRoomStatusMutation.error instanceof Error
                  ? updateRoomStatusMutation.error.message
                  : "Please try again."
              }
            />
          )}
        </div>

        <div className={styles.modalFooter}>
          <Button
            onClick={closeMaintenanceModal}
            disabled={updateRoomStatusMutation.isPending}
          >
            Cancel
          </Button>

          <Button
            danger
            type="primary"
            loading={updateRoomStatusMutation.isPending}
            disabled={!maintenanceRoom}
            onClick={() => void handleMaintenanceSubmit()}
          >
            Mark Under Maintenance
          </Button>
        </div>
      </Modal>

      <RoomChangeModal
        open={roomChangeOpen}
        onClose={() => setRoomChangeOpen(false)}
        onCompleted={(result) =>
          setSuccessMessage(
            `Room changed from ${result.previousRoomNumber} to ${result.roomNumber}.`,
          )
        }
      />
    </section>
  );
}

type LegendItemProps = {
  className: string;
  label: string;
};

function LegendItem({ className, label }: LegendItemProps) {
  return (
    <span className={styles.legendItem}>
      <span
        className={`${styles.legendSwatch} ${className}`}
        aria-hidden="true"
      />

      {label}
    </span>
  );
}
