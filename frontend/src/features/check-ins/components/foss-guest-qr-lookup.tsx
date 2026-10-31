"use client";

import { useState } from "react";
import { Button, Input } from "antd";
import { FossGuestQrActions } from "./foss-guest-qr-actions";

/** Allows authorized staff to print a replacement after leaving the check-in screen. */
export function FossGuestQrLookup() {
  const [draft, setDraft] = useState("");
  const [selectedReference, setSelectedReference] = useState<string | null>(
    null,
  );
  const validUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      draft.trim(),
    );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}
    >
      <p style={{ margin: 0 }}>
        Need a replacement after leaving the check-in result? Enter the active
        booking UUID. FDS will verify that the guest is still checked in before
        allowing QR issuance.
      </p>
      <label htmlFor="fds-qr-existing-booking">
        Checked-in booking reference
      </label>
      <Input
        id="fds-qr-existing-booking"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setSelectedReference(null);
        }}
        placeholder="Booking UUID"
      />
      <Button
        disabled={!validUuid}
        onClick={() => setSelectedReference(draft.trim())}
      >
        Select Checked-In Booking
      </Button>
      {selectedReference && (
        <FossGuestQrActions
          key={selectedReference}
          bookingReference={selectedReference}
        />
      )}
    </div>
  );
}
