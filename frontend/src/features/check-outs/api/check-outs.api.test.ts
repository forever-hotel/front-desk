import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";

import { checkOutGuest } from "./check-outs.api";

import type { CreateCheckOutRequest } from "../types/check-out.type";

const bookingReference = "11111111-1111-4111-8111-111111111111";

const receptionistId = "22222222-2222-4222-8222-222222222222";

describe("check-outs.api", () => {
  it("Given an outstanding balance, when checkout is submitted, then the backend payment result is returned", async () => {
    const payload: CreateCheckOutRequest = {
      bookingReference,
      performedBy: receptionistId,
      paymentMethod: "CASH",
    };

    let receivedBody: unknown = null;

    server.use(
      http.post("*/check-outs", async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json({
          status: "checked_out",
          bookingReference,
          roomNumber: "101",
          bookingStatus: "CHECKED_OUT",
          roomStatus: "REQUIRES_CLEANING",
          currency: "LKR",
          folioTotal: 25000,
          previouslyPaid: 10000,
          finalPaymentAmount: 15000,
          payment: {
            paymentId: "33333333-3333-4333-8333-333333333333",
            paymentMethod: "CASH",
            paymentStatus: "COMPLETED",
            amount: 15000,
            paidAt: "2026-10-08T06:00:00.000Z",
          },
          auditLogId: "44444444-4444-4444-8444-444444444444",
          fossSession: {
            status: "DEACTIVATED",
          },
        });
      }),
    );

    const result = await checkOutGuest(payload);

    expect(receivedBody).toEqual(payload);

    expect(result.status).toBe("checked_out");
    expect(result.bookingStatus).toBe("CHECKED_OUT");
    expect(result.roomStatus).toBe("REQUIRES_CLEANING");

    expect(result.folioTotal).toBe(25000);
    expect(result.previouslyPaid).toBe(10000);
    expect(result.finalPaymentAmount).toBe(15000);

    expect(result.payment?.paymentStatus).toBe("COMPLETED");
    expect(result.fossSession.status).toBe("DEACTIVATED");
  });

  it("Given a fully paid folio, when checkout is submitted without a new payment method, then checkout succeeds without a new payment", async () => {
    const payload: CreateCheckOutRequest = {
      bookingReference,
      performedBy: receptionistId,
    };

    let receivedBody: unknown = null;

    server.use(
      http.post("*/check-outs", async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json({
          status: "checked_out",
          bookingReference,
          roomNumber: "101",
          bookingStatus: "CHECKED_OUT",
          roomStatus: "REQUIRES_CLEANING",
          currency: "LKR",
          folioTotal: 20000,
          previouslyPaid: 20000,
          finalPaymentAmount: 0,
          payment: null,
          auditLogId: "44444444-4444-4444-8444-444444444444",
          fossSession: {
            status: "FAILED",
            failureCode: "FOSS_DEACTIVATION_FAILED",
          },
        });
      }),
    );

    const result = await checkOutGuest(payload);

    expect(receivedBody).toEqual(payload);

    expect(result.finalPaymentAmount).toBe(0);
    expect(result.payment).toBeNull();

    expect(result.status).toBe("checked_out");
    expect(result.fossSession.status).toBe("FAILED");
  });

  it("Given an invalid checkout state, when checkout is attempted, then the backend conflict is propagated", async () => {
    server.use(
      http.post("*/check-outs", () => {
        return HttpResponse.json(
          {
            message: "Checkout requires a CHECKED_IN booking",
          },
          { status: 409 },
        );
      }),
    );

    await expect(
      checkOutGuest({
        bookingReference,
        performedBy: receptionistId,
        paymentMethod: "CARD_ON_SITE",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Checkout requires a CHECKED_IN booking",
    });
  });
});
