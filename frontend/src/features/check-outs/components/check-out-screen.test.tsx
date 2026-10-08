import { http, HttpResponse } from "msw";

import { screen } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { axe } from "jest-axe";

import { bookingFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { CheckOutScreen } from "./check-out-screen";

const checkedInBooking = bookingFixtures[1];

const receptionistId = "44444444-4444-4444-8444-444444444444";

const folioFixture = {
  bookingReference: checkedInBooking.bookingReference,
  roomNumber: "101",
  checkInDate: "2026-10-06",
  checkOutDate: "2026-10-08",
  bookingStatus: "CHECKED_IN",
  currency: "LKR",
  categories: [
    {
      category: "ROOM_CHARGES",
      items: [
        {
          reference: "room-charge-001",
          description: "Room accommodation",
          amount: 20000,
          occurredAt: "2026-10-06T10:00:00.000Z",
        },
      ],
      subtotal: 20000,
    },
    {
      category: "FOOD_AND_BEVERAGE",
      items: [
        {
          reference: "food-charge-001",
          description: "Restaurant charges",
          amount: 3500,
          occurredAt: "2026-10-07T12:00:00.000Z",
        },
      ],
      subtotal: 3500,
    },
    {
      category: "SERVICES",
      items: [],
      subtotal: 0,
    },
  ],
  total: 23500,
};

function mockCheckedInGuestAndFolio() {
  server.use(
    http.get("*/bookings/search", () => {
      return HttpResponse.json([checkedInBooking]);
    }),

    http.get("*/folios/:bookingReference", ({ params }) => {
      if (params.bookingReference !== checkedInBooking.bookingReference) {
        return HttpResponse.json(
          { message: "Booking not found" },
          { status: 404 },
        );
      }

      return HttpResponse.json(folioFixture);
    }),
  );
}

async function searchForGuest() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("SEARCH GUEST / BOOKING"), "Nimali");

  await user.click(
    screen.getByRole("button", {
      name: "Search",
    }),
  );

  return user;
}

async function loadGuestFolio() {
  const user = await searchForGuest();

  expect(
    await screen.findByText("Room accommodation", {}, { timeout: 8000 }),
  ).toBeInTheDocument();

  return user;
}

function mockSuccessfulCheckout(
  fossStatus: "DEACTIVATED" | "FAILED" = "DEACTIVATED",
) {
  server.use(
    http.post("*/check-outs", () => {
      return HttpResponse.json({
        status: "checked_out",
        bookingReference: checkedInBooking.bookingReference,
        roomNumber: "101",
        bookingStatus: "CHECKED_OUT",
        roomStatus: "REQUIRES_CLEANING",
        currency: "LKR",
        folioTotal: 23500,
        previouslyPaid: 10000,
        finalPaymentAmount: 13500,
        payment: {
          paymentId: "55555555-5555-4555-8555-555555555555",
          paymentMethod: "CASH",
          paymentStatus: "COMPLETED",
          amount: 13500,
          paidAt: "2026-10-08T06:00:00.000Z",
        },
        auditLogId: "66666666-6666-4666-8666-666666666666",
        fossSession: {
          status: fossStatus,
          ...(fossStatus === "FAILED"
            ? {
                failureCode: "FOSS_DEACTIVATION_FAILED",
              }
            : {}),
        },
      });
    }),
  );
}

describe("CheckOutScreen", () => {
  it("Given the initial screen, when opened, then the guest search is available and no folio is displayed", () => {
    renderWithProviders(<CheckOutScreen />);

    expect(
      screen.getByRole("heading", {
        name: "Guest Check-Out",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("FIND GUEST FOR CHECK-OUT")).toBeInTheDocument();

    expect(screen.getByLabelText("SEARCH GUEST / BOOKING")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Search",
      }),
    ).toBeDisabled();

    expect(
      screen.getByText(
        "Search for a currently checked-in guest to begin checkout.",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText("ITEMISED FOLIO")).not.toBeInTheDocument();
  });

  it("Given confirmed and checked-out bookings, when searched, then they cannot proceed to checkout", async () => {
    server.use(
      http.get("*/bookings/search", () => {
        return HttpResponse.json([bookingFixtures[0], bookingFixtures[2]]);
      }),
    );

    renderWithProviders(<CheckOutScreen />);

    await searchForGuest();

    expect(
      await screen.findByText(
        "No checked-in booking matched this search.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText("PAYMENT SETTLEMENT")).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /Confirm Check-Out & Settle/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("Given a checked-in guest with a running folio, when searched, then charges are displayed and unauthenticated checkout is blocked", async () => {
    mockCheckedInGuestAndFolio();

    let checkoutRequestCount = 0;

    server.use(
      http.post("*/check-outs", () => {
        checkoutRequestCount += 1;

        return HttpResponse.json({
          status: "checked_out",
        });
      }),
    );

    renderWithProviders(<CheckOutScreen />);

    await loadGuestFolio();

    expect(screen.getByText("ITEMISED FOLIO")).toBeInTheDocument();

    expect(screen.getByText("Room accommodation")).toBeInTheDocument();

    expect(screen.getByText("Restaurant charges")).toBeInTheDocument();

    expect(screen.getByText("PAYMENT SETTLEMENT")).toBeInTheDocument();

    expect(screen.getByText("Total Folio Charges")).toBeInTheDocument();

    expect(screen.getAllByText("LKR 23,500").length).toBeGreaterThanOrEqual(1);

    expect(
      screen.getByText("Final payment is calculated by the backend."),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Authenticated receptionist integration is required."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Confirm Check-Out & Settle/i,
      }),
    ).toBeDisabled();

    expect(checkoutRequestCount).toBe(0);
  });

  it("Given the folio service fails, when the guest is selected, then an error and retry action are displayed", async () => {
    server.use(
      http.get("*/bookings/search", () => {
        return HttpResponse.json([checkedInBooking]);
      }),

      http.get("*/folios/:bookingReference", () => {
        return HttpResponse.json(
          {
            message: "Folio temporarily unavailable",
          },
          {
            status: 503,
          },
        );
      }),
    );

    renderWithProviders(<CheckOutScreen performedBy={receptionistId} />);

    await searchForGuest();

    expect(
      await screen.findByText(
        "Unable to load guest folio.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Folio temporarily unavailable"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Retry",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /Confirm Check-Out & Settle/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("Given a loaded folio and authenticated receptionist, when checkout succeeds, then backend settlement, room status and FOSS result are displayed", async () => {
    mockCheckedInGuestAndFolio();

    let receivedPayload: unknown = null;

    server.use(
      http.post("*/check-outs", async ({ request }) => {
        receivedPayload = await request.json();

        return HttpResponse.json({
          status: "checked_out",
          bookingReference: checkedInBooking.bookingReference,
          roomNumber: "101",
          bookingStatus: "CHECKED_OUT",
          roomStatus: "REQUIRES_CLEANING",
          currency: "LKR",
          folioTotal: 23500,
          previouslyPaid: 10000,
          finalPaymentAmount: 13500,
          payment: {
            paymentId: "55555555-5555-4555-8555-555555555555",
            paymentMethod: "CASH",
            paymentStatus: "COMPLETED",
            amount: 13500,
            paidAt: "2026-10-08T06:00:00.000Z",
          },
          auditLogId: "66666666-6666-4666-8666-666666666666",
          fossSession: {
            status: "DEACTIVATED",
          },
        });
      }),
    );

    renderWithProviders(<CheckOutScreen performedBy={receptionistId} />);

    const user = await loadGuestFolio();

    const confirmButton = screen.getByRole("button", {
      name: /Confirm Check-Out & Settle/i,
    });

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(
      await screen.findByText(
        "Guest check-out completed successfully.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(receivedPayload).toEqual({
      bookingReference: checkedInBooking.bookingReference,
      performedBy: receptionistId,
      paymentMethod: "CASH",
    });

    expect(
      screen.getByText("FINAL SETTLEMENT — BACKEND CONFIRMED"),
    ).toBeInTheDocument();

    expect(screen.getByText("PREVIOUSLY PAID")).toBeInTheDocument();

    expect(screen.getByText("FINAL PAYMENT")).toBeInTheDocument();

    expect(screen.getByText("LKR 13,500")).toBeInTheDocument();

    expect(
      screen.getByText("Room 101 → Requires Cleaning"),
    ).toBeInTheDocument();

    expect(screen.getByText("FOSS session deactivated.")).toBeInTheDocument();

    expect(screen.queryByText("ITEMISED FOLIO")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "New Check-Out",
      }),
    );

    expect(screen.getByLabelText("SEARCH GUEST / BOOKING")).toHaveValue("");

    expect(
      screen.queryByText("Guest check-out completed successfully."),
    ).not.toBeInTheDocument();
  });

  it("Given checkout succeeds but FOSS deactivation fails, when the backend responds, then checkout success is preserved with a FOSS warning", async () => {
    mockCheckedInGuestAndFolio();

    mockSuccessfulCheckout("FAILED");

    renderWithProviders(<CheckOutScreen performedBy={receptionistId} />);

    const user = await loadGuestFolio();

    await user.click(
      screen.getByRole("button", {
        name: /Confirm Check-Out & Settle/i,
      }),
    );

    expect(
      await screen.findByText(
        "Guest check-out completed successfully.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Checkout succeeded, but FOSS deactivation failed."),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Room 101 → Requires Cleaning"),
    ).toBeInTheDocument();
  });

  it("Given the backend rejects checkout, when submitted, then the error is shown without displaying a completed checkout", async () => {
    mockCheckedInGuestAndFolio();

    server.use(
      http.post("*/check-outs", () => {
        return HttpResponse.json(
          {
            message: "Checkout requires a CHECKED_IN booking",
          },
          {
            status: 409,
          },
        );
      }),
    );

    renderWithProviders(<CheckOutScreen performedBy={receptionistId} />);

    const user = await loadGuestFolio();

    await user.click(
      screen.getByRole("button", {
        name: /Confirm Check-Out & Settle/i,
      }),
    );

    expect(
      await screen.findByText(
        "Guest checkout could not be completed.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Checkout requires a CHECKED_IN booking"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("FINAL SETTLEMENT — BACKEND CONFIRMED"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Guest check-out completed successfully."),
    ).not.toBeInTheDocument();
  });

  it("Given the initial checkout screen, when accessibility is checked, then it has no detectable violations", async () => {
    const { container } = renderWithProviders(<CheckOutScreen />);

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
