"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Input } from "antd";

import {
  confirmWalkInPayment,
  getPendingWalkInPayment,
} from "../api/reservations.api";
import type {
  WalkInPaymentConfirmationResult,
  WalkInPendingPayment,
} from "../types/reservation.type";
import styles from "./walk-in-booking-screen.module.css";

type Props = {
  initialBookingReference?: string;
  onConfirmed?: (payment: WalkInPaymentConfirmationResult) => void;
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function WalkInPaymentConfirmation({
  initialBookingReference = "",
  onConfirmed,
}: Props) {
  const [reference, setReference] = useState(initialBookingReference);
  const [pending, setPending] = useState<WalkInPendingPayment | null>(null);
  const [approvedReceipt, setApprovedReceipt] = useState("");
  const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] =
    useState<WalkInPaymentConfirmationResult | null>(null);

  const isCard = pending?.paymentMethod === "CARD_ON_SITE";

  async function loadPendingPayment() {
    setError(null);
    setPending(null);
    setReceived(false);
    setApprovedReceipt("");
    setConfirmed(null);
    if (!UUID_V4.test(reference.trim())) {
      setError("Enter a valid booking reference (UUID) before continuing.");
      return;
    }
    setBusy(true);
    try {
      const details = await getPendingWalkInPayment(reference.trim());
      setPending(details);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load pending payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending || !received || busy) return;
    setError(null);
    if (isCard && !approvedReceipt.trim()) {
      setError("Enter the approved card-terminal receipt reference.");
      return;
    }
    setBusy(true);
    try {
      const payment = await confirmWalkInPayment(pending.bookingReference, {
        confirmedReceived: true,
        receiptReference: approvedReceipt.trim() || undefined,
      });
      setConfirmed(payment);
      setPending(null);
      onConfirmed?.(payment);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Payment confirmation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-label="Walk-in payment confirmation">
      <div className={styles.cardHeader}>CONFIRM WALK-IN PAYMENT</div>
      <div className={styles.cardBody}>
        <Alert
          type="info"
          showIcon
          message="Booking creation does not collect payment."
          description="Confirm only after receiving cash or verifying an approved card-terminal transaction. This is a manual staff confirmation, not an integrated payment charge."
        />
        <div className={styles.field}>
          <label htmlFor="walk-in-pending-booking-reference">
            BOOKING REFERENCE
          </label>
          <Input
            id="walk-in-pending-booking-reference"
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setPending(null);
              setReceived(false);
              setConfirmed(null);
            }}
            disabled={busy}
            placeholder="Paste the pending walk-in booking UUID"
            maxLength={36}
          />
        </div>
        <Button
          onClick={() => void loadPendingPayment()}
          loading={busy}
          disabled={!reference.trim() || Boolean(confirmed)}
        >
          Find Pending Payment
        </Button>
        {pending && (
          <>
            <div className={styles.paymentSummary}>
              <div>
                <span>AMOUNT TO COLLECT</span>
                <strong>{`LKR ${new Intl.NumberFormat("en-LK").format(pending.amount)}`}</strong>
              </div>
              <div>
                <span>RECORDED PAYMENT METHOD</span>
                <strong>
                  {pending.paymentMethod === "CASH" ? "Cash" : "Card on site"}
                </strong>
              </div>
            </div>
            {isCard && (
              <div className={styles.field}>
                <label htmlFor="walk-in-approved-receipt">
                  APPROVED POS RECEIPT REFERENCE
                </label>
                <Input
                  id="walk-in-approved-receipt"
                  value={approvedReceipt}
                  onChange={(event) => setApprovedReceipt(event.target.value)}
                  maxLength={80}
                  disabled={busy}
                  placeholder="Approved terminal receipt/reference"
                />
              </div>
            )}
            <Checkbox
              checked={received}
              disabled={busy}
              onChange={(event) => setReceived(event.target.checked)}
            >
              {isCard
                ? "I verified the approved card terminal payment and receipt."
                : "I personally received the full cash payment."}
            </Checkbox>
            <Button
              type="primary"
              block
              disabled={!received || (isCard && !approvedReceipt.trim())}
              loading={busy}
              onClick={() => void confirm()}
            >
              Confirm Payment Received
            </Button>
          </>
        )}
        {error && <Alert type="error" showIcon message={error} />}
        {confirmed && (
          <Alert
            type="success"
            showIcon
            message="Payment recorded and booking confirmed."
            description={`Booking ${confirmed.bookingReference} is now eligible for Check-In. Payment audit ID: ${confirmed.auditLogId}`}
          />
        )}
      </div>
    </section>
  );
}
