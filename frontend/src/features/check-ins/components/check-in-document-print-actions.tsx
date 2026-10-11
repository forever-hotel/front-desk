"use client";

import { Alert, Button } from "antd";

import { useCheckInPrint } from "../hooks/use-check-in-print";
import type { CheckInDocumentType } from "../types/check-in.type";

import styles from "./check-in-document-print-actions.module.css";

type CheckInDocumentPrintActionsProps = {
  bookingReference?: string | null;
};

function documentLabel(documentType: CheckInDocumentType): string {
  return documentType === "REGISTRATION_CARD"
    ? "Registration-card"
    : "Payment-receipt";
}

/**
 * Requests a check-in document print job. A successful HTTP response means
 * accepted by the backend, NOT that a paper document has been printed.
 * The backend remains the authority for booking status and role checks.
 */
export function CheckInDocumentPrintActions({
  bookingReference,
}: CheckInDocumentPrintActionsProps) {
  const printMutation = useCheckInPrint();

  const canRequest = Boolean(bookingReference?.trim());
  const inProgress = printMutation.isPending;

  const requestDocument = (documentType: CheckInDocumentType) => {
    if (!bookingReference?.trim() || inProgress) {
      return;
    }

    printMutation.mutate({
      bookingReference,
      payload: { documentType },
    });
  };

  const pendingType = printMutation.variables?.payload.documentType;
  const errorLabel = pendingType ? documentLabel(pendingType) : "Document";
  const acceptedLabel = printMutation.data
    ? documentLabel(printMutation.data.documentType)
    : "Document";

  return (
    <div
      className={styles.wrapper}
      aria-label="Check-in document print requests"
    >
      <div className={styles.actions}>
        <Button
          type="default"
          disabled={!canRequest || inProgress}
          loading={inProgress && pendingType === "REGISTRATION_CARD"}
          onClick={() => requestDocument("REGISTRATION_CARD")}
        >
          Print Registration Card
        </Button>

        <Button
          type="default"
          disabled={!canRequest || inProgress}
          loading={inProgress && pendingType === "PAYMENT_RECEIPT"}
          onClick={() => requestDocument("PAYMENT_RECEIPT")}
        >
          Request Payment Receipt
        </Button>
      </div>

      {printMutation.isError && (
        <Alert
          role="alert"
          type="error"
          showIcon
          title={`${errorLabel} print request failed.`}
          description={
            printMutation.error instanceof Error
              ? printMutation.error.message
              : "Please try again."
          }
        />
      )}

      {printMutation.isSuccess && (
        <div role="status" className={styles.feedback}>
          <Alert
            type="success"
            showIcon
            title={`${acceptedLabel} print request accepted.`}
            description={`Print job: ${printMutation.data.printJobReference}. Physical printing has not been confirmed.`}
          />
        </div>
      )}
    </div>
  );
}
