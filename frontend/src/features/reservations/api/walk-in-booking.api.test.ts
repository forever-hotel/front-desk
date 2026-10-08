import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";

import { createWalkInBooking } from "./reservations.api";

import type { CreateWalkInBookingRequest } from "../types/reservation.type";

const roomTypeId = "11111111-1111-4111-8111-111111111111";

const bookingReference = "22222222-2222-4222-8222-222222222222";

describe("walk-in-booking.api", () => {
  it("Given valid guest and stay details, when a cash walk-in booking is submitted, then the backend-confirmed booking is returned", async () => {
    const payload: CreateWalkInBookingRequest = {
      guest: {
        fullName: "Test Guest",
        email: "guest@example.com",
        phone: "0771234567",
        nicOrPassport: "TEST123456",
      },
      booking: {
        roomTypeId,
        checkInDate: "2026-10-08",
        checkOutDate: "2026-10-10",
        numGuests: 2,
        specialRequests: "Extra pillows",
      },
      payment: {
        paymentMethod: "CASH",
      },
    };

    let receivedBody: unknown = null;

    server.use(
      http.post("*/bookings/walk-in", async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(
          {
            bookingId: bookingReference,
            bookingReference,
            guestId: "33333333-3333-4333-8333-333333333333",
            guestAccountLinked: false,
            guest: payload.guest,
            roomTypeId,
            roomType: "Deluxe",
            checkInDate: payload.booking.checkInDate,
            checkOutDate: payload.booking.checkOutDate,
            numGuests: 2,
            specialRequests: "Extra pillows",
            totalAmount: 30000,
            currency: "LKR",
            status: "CONFIRMED",
            source: "WALK_IN",
            payment: {
              paymentId: "44444444-4444-4444-8444-444444444444",
              paymentMethod: "CASH",
              paymentStatus: "COMPLETED",
              amount: 30000,
              paidAt: "2026-10-08T06:00:00.000Z",
            },
          },
          { status: 201 },
        );
      }),
    );

    const result = await createWalkInBooking(payload);

    expect(receivedBody).toEqual(payload);

    expect(result.bookingReference).toBe(bookingReference);

    expect(result.status).toBe("CONFIRMED");

    expect(result.source).toBe("WALK_IN");

    expect(result.totalAmount).toBe(30000);

    expect(result.currency).toBe("LKR");

    expect(result.payment.paymentMethod).toBe("CASH");

    expect(result.payment.paymentStatus).toBe("COMPLETED");
  });

  it("Given card-on-site payment, when a walk-in booking is submitted, then the pending status from the backend is preserved", async () => {
    const payload: CreateWalkInBookingRequest = {
      guest: {
        fullName: "Card Payment Guest",
        email: "card@example.com",
      },
      booking: {
        roomTypeId,
        checkInDate: "2026-10-08",
        checkOutDate: "2026-10-09",
        numGuests: 1,
      },
      payment: {
        paymentMethod: "CARD_ON_SITE",
      },
    };

    let receivedBody: unknown = null;

    server.use(
      http.post("*/bookings/walk-in", async ({ request }) => {
        receivedBody = await request.json();

        return HttpResponse.json(
          {
            bookingId: bookingReference,
            bookingReference,
            guestId: null,
            guestAccountLinked: false,
            guest: payload.guest,
            roomTypeId,
            roomType: "Standard",
            checkInDate: payload.booking.checkInDate,
            checkOutDate: payload.booking.checkOutDate,
            numGuests: 1,
            specialRequests: null,
            totalAmount: 12000,
            currency: "LKR",
            status: "PENDING",
            source: "WALK_IN",
            payment: {
              paymentId: "44444444-4444-4444-8444-444444444444",
              paymentMethod: "CARD_ON_SITE",
              paymentStatus: "PENDING",
              amount: 12000,
              paidAt: null,
            },
          },
          { status: 201 },
        );
      }),
    );

    const result = await createWalkInBooking(payload);

    expect(receivedBody).toEqual(payload);

    expect(result.status).toBe("PENDING");

    expect(result.payment.paymentStatus).toBe("PENDING");

    expect(result.payment.paymentMethod).toBe("CARD_ON_SITE");
  });

  it("Given an invalid walk-in request, when submitted, then the backend validation error is propagated", async () => {
    server.use(
      http.post("*/bookings/walk-in", () => {
        return HttpResponse.json(
          {
            message: "Check-out date must be after check-in date",
          },
          {
            status: 400,
          },
        );
      }),
    );

    const payload: CreateWalkInBookingRequest = {
      guest: {
        fullName: "Test Guest",
        email: "guest@example.com",
      },
      booking: {
        roomTypeId,
        checkInDate: "2026-10-10",
        checkOutDate: "2026-10-08",
        numGuests: 1,
      },
      payment: {
        paymentMethod: "CASH",
      },
    };

    await expect(createWalkInBooking(payload)).rejects.toMatchObject({
      status: 400,
      message: "Check-out date must be after check-in date",
    });
  });
});
