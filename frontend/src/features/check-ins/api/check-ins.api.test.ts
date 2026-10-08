import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";

import { checkInGuest, requestCheckInPrint } from "./check-ins.api";

import type { CheckInRequest } from "../types/check-in.type";

const bookingReference = "11111111-1111-4111-8111-111111111111";

const receptionistId = "22222222-2222-4222-8222-222222222222";

describe("check-ins.api", () => {
  it("Given a verified guest and selected room, when check-in is submitted, then the correct payload is sent", async () => {
    const payload: CheckInRequest = {
      bookingReference,
      roomNumber: "101",
      verification: {
        documentType: "NIC",
        verificationMethod: "PHYSICAL_DOCUMENT",
        verifiedBy: receptionistId,
      },
    };

    let receivedBody: unknown = null;

    server.use(
      http.post("*/check-in", async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json({
          status: "checked_in",
          bookingReference,
          roomNumber: "101",
          bookingStatus: "CHECKED_IN",
          roomStatus: "OCCUPIED",
          verification: {
            verificationId: "33333333-3333-4333-8333-333333333333",
            documentType: "NIC",
            verificationMethod: "PHYSICAL_DOCUMENT",
            verifiedBy: receptionistId,
            verifiedAt: "2026-10-08T06:00:00.000Z",
          },
          auditLogId: "44444444-4444-4444-8444-444444444444",
          fossSession: {
            status: "ACTIVATED",
            sessionReference: "foss-session-1",
            validUntilDate: "2026-10-10",
          },
        });
      }),
    );

    const result = await checkInGuest(payload);

    expect(receivedBody).toEqual(payload);

    expect(result.status).toBe("checked_in");
    expect(result.bookingReference).toBe(bookingReference);
    expect(result.roomNumber).toBe("101");
    expect(result.roomStatus).toBe("OCCUPIED");
    expect(result.fossSession.status).toBe("ACTIVATED");
  });

  it("Given scanned-document verification metadata, when check-in is submitted, then the metadata is preserved", async () => {
    const payload: CheckInRequest = {
      bookingReference,
      roomNumber: "102",
      verification: {
        documentType: "PASSPORT",
        verificationMethod: "SCANNED_COPY",
        verifiedBy: receptionistId,
        documentStorageKey: "secure/check-in/document-1",
        documentSha256: "a".repeat(64),
        notes: "Verified at reception",
      },
    };

    let receivedBody: unknown = null;

    server.use(
      http.post("*/check-in", async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json({
          status: "checked_in",
          bookingReference,
          roomNumber: "102",
          bookingStatus: "CHECKED_IN",
          roomStatus: "OCCUPIED",
          verification: {
            verificationId: "33333333-3333-4333-8333-333333333333",
            documentType: "PASSPORT",
            verificationMethod: "SCANNED_COPY",
            verifiedBy: receptionistId,
            verifiedAt: "2026-10-08T06:00:00.000Z",
          },
          auditLogId: "44444444-4444-4444-8444-444444444444",
          fossSession: {
            status: "FAILED",
            sessionReference: null,
            validUntilDate: "2026-10-10",
            failureCode: "FOSS_ACTIVATION_FAILED",
          },
        });
      }),
    );

    const result = await checkInGuest(payload);

    expect(receivedBody).toEqual(payload);
    expect(result.status).toBe("checked_in");
    expect(result.fossSession.status).toBe("FAILED");
  });

  it("Given a room conflict, when check-in is submitted, then the backend error is propagated", async () => {
    server.use(
      http.post("*/check-in", () => {
        return HttpResponse.json(
          {
            message: "Selected room is not available",
          },
          { status: 409 },
        );
      }),
    );

    await expect(
      checkInGuest({
        bookingReference,
        roomNumber: "101",
        verification: {
          documentType: "NIC",
          verificationMethod: "PHYSICAL_DOCUMENT",
          verifiedBy: receptionistId,
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Selected room is not available",
    });
  });

  it("Given a completed check-in, when registration-card printing is requested, then the booking reference and document type are sent", async () => {
    let receivedBody: unknown = null;
    let receivedReference: string | undefined;

    server.use(
      http.post(
        "*/check-in/:bookingReference/print",
        async ({ request, params }) => {
          receivedBody = await request.json();
          receivedReference = String(params.bookingReference);

          return HttpResponse.json({
            status: "accepted",
            documentType: "REGISTRATION_CARD",
            bookingReference,
            roomNumber: "101",
            printJobReference: "print-job-1",
          });
        },
      ),
    );

    const result = await requestCheckInPrint(bookingReference, {
      documentType: "REGISTRATION_CARD",
    });

    expect(receivedReference).toBe(bookingReference);

    expect(receivedBody).toEqual({
      documentType: "REGISTRATION_CARD",
    });

    expect(result.status).toBe("accepted");
    expect(result.printJobReference).toBe("print-job-1");
  });

  it("Given a print-service failure, when printing is requested, then the error is returned", async () => {
    server.use(
      http.post("*/check-in/:bookingReference/print", () => {
        return HttpResponse.json(
          { message: "Print service unavailable" },
          { status: 503 },
        );
      }),
    );

    await expect(
      requestCheckInPrint(bookingReference, {
        documentType: "PAYMENT_RECEIPT",
      }),
    ).rejects.toMatchObject({
      status: 503,
      message: "Print service unavailable",
    });
  });
});
