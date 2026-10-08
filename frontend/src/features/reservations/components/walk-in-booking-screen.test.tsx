import { http, HttpResponse } from "msw";

import { fireEvent, screen, within } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { axe } from "jest-axe";

import { roomFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { WalkInBookingScreen } from "./walk-in-booking-screen";

const bookingReference = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  server.use(
    http.get("*/rooms/status", () => {
      return HttpResponse.json(roomFixtures);
    }),
  );
});

async function waitForRoomInventory() {
  await screen.findByText("1 vacant now / 2 total", {}, { timeout: 8000 });
}

async function selectStandardRoomType(
  user: ReturnType<typeof userEvent.setup>,
) {
  await waitForRoomInventory();

  const inventoryText = screen.getByText("1 vacant now / 2 total");

  const roomTypeRow = inventoryText.parentElement?.parentElement;

  if (!roomTypeRow) {
    throw new Error("Standard room type row was not found.");
  }

  await user.click(
    within(roomTypeRow).getByRole("button", {
      name: "Select",
    }),
  );

  expect(
    within(roomTypeRow).getByRole("button", {
      name: "Selected",
    }),
  ).toBeInTheDocument();
}

async function fillRequiredDetails() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("FULL NAME"), "Test Guest");

  await user.type(screen.getByLabelText("EMAIL"), "guest@example.com");

  await selectStandardRoomType(user);

  fireEvent.change(screen.getByLabelText("CHECK-IN DATE"), {
    target: { value: "2026-10-08" },
  });

  fireEvent.change(screen.getByLabelText("CHECK-OUT DATE"), {
    target: { value: "2026-10-10" },
  });

  return user;
}

function getSubmitButton() {
  return screen.getByRole("button", {
    name: /Create Walk-In Booking/i,
  });
}

describe("WalkInBookingScreen", () => {
  it("Given the initial screen, when opened, then guest details, booking details and payment sections are displayed", async () => {
    renderWithProviders(<WalkInBookingScreen />);

    expect(
      screen.getByRole("heading", {
        name: "Walk-In Booking",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("GUEST DETAILS")).toBeInTheDocument();

    expect(screen.getByText("BOOKING DETAILS")).toBeInTheDocument();

    expect(
      screen.getByText("ROOM TYPES — CURRENT INVENTORY"),
    ).toBeInTheDocument();

    expect(screen.getByText("PAYMENT")).toBeInTheDocument();

    expect(screen.getByLabelText("FULL NAME")).toBeInTheDocument();

    expect(screen.getByLabelText("EMAIL")).toBeInTheDocument();

    expect(screen.getByLabelText("NIC / PASSPORT NO.")).toBeInTheDocument();

    await waitForRoomInventory();

    expect(screen.getByText("1 vacant now / 2 total")).toBeInTheDocument();

    expect(screen.getAllByText("0 vacant now / 1 total")).toHaveLength(2);

    expect(
      screen.getByText(
        "The backend calculates the final booking total after submission.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Walk-in booking created successfully."),
    ).not.toBeInTheDocument();
  });

  it("Given missing required guest details, when booking creation is attempted, then validation prevents submission", async () => {
    let requestCount = 0;

    server.use(
      http.post("*/bookings/walk-in", () => {
        requestCount += 1;

        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithProviders(<WalkInBookingScreen />);

    await waitForRoomInventory();

    const user = userEvent.setup();

    await user.click(getSubmitButton());

    expect(
      screen.getByText("Guest full name is required."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("FULL NAME"), "Test Guest");

    await user.click(getSubmitButton());

    expect(screen.getByText("Guest email is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("EMAIL"), "guest@example.com");

    await user.click(getSubmitButton());

    expect(screen.getByText("Please select a room type.")).toBeInTheDocument();

    expect(requestCount).toBe(0);
  });

  it("Given missing or invalid stay dates, when booking creation is attempted, then checkout date validation is enforced", async () => {
    let requestCount = 0;

    server.use(
      http.post("*/bookings/walk-in", () => {
        requestCount += 1;

        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderWithProviders(<WalkInBookingScreen />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText("FULL NAME"), "Test Guest");

    await user.type(screen.getByLabelText("EMAIL"), "guest@example.com");

    await selectStandardRoomType(user);

    await user.click(getSubmitButton());

    expect(
      screen.getByText("Check-in and check-out dates are required."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("CHECK-IN DATE"), {
      target: { value: "2026-10-10" },
    });

    fireEvent.change(screen.getByLabelText("CHECK-OUT DATE"), {
      target: { value: "2026-10-08" },
    });

    await user.click(getSubmitButton());

    expect(
      screen.getByText("Check-out date must be after check-in date."),
    ).toBeInTheDocument();

    expect(requestCount).toBe(0);
  });

  it("Given complete guest and booking details, when a cash walk-in booking succeeds, then the correct payload and backend-confirmed result are displayed", async () => {
    let receivedPayload: unknown = null;

    server.use(
      http.post("*/bookings/walk-in", async ({ request }) => {
        receivedPayload = await request.json();

        return HttpResponse.json(
          {
            bookingId: bookingReference,
            bookingReference,
            guestId: "22222222-2222-4222-8222-222222222222",
            guestAccountLinked: false,
            guest: {
              fullName: "Test Guest",
              email: "guest@example.com",
            },
            roomTypeId: "room-type-1",
            roomType: "Standard",
            checkInDate: "2026-10-08",
            checkOutDate: "2026-10-10",
            numGuests: 1,
            specialRequests: null,
            totalAmount: 18000,
            currency: "LKR",
            status: "CONFIRMED",
            source: "WALK_IN",
            payment: {
              paymentId: "33333333-3333-4333-8333-333333333333",
              paymentMethod: "CASH",
              paymentStatus: "COMPLETED",
              amount: 18000,
              paidAt: "2026-10-08T06:00:00.000Z",
            },
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<WalkInBookingScreen />);

    const user = await fillRequiredDetails();

    await user.type(screen.getByLabelText("NIC / PASSPORT NO."), "TEST123456");

    await user.type(screen.getByLabelText("PHONE"), "0771234567");

    await user.type(screen.getByLabelText("SPECIAL REQUESTS"), "Extra pillows");

    await user.click(getSubmitButton());

    expect(
      await screen.findByText(
        "Walk-in booking created successfully.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(receivedPayload).toEqual({
      guest: {
        fullName: "Test Guest",
        email: "guest@example.com",
        nicOrPassport: "TEST123456",
        phone: "0771234567",
      },
      booking: {
        roomTypeId: "room-type-1",
        checkInDate: "2026-10-08",
        checkOutDate: "2026-10-10",
        numGuests: 1,
        specialRequests: "Extra pillows",
      },
      payment: {
        paymentMethod: "CASH",
      },
    });

    expect(screen.getByText(bookingReference)).toBeInTheDocument();

    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();

    expect(screen.getByText("COMPLETED")).toBeInTheDocument();

    expect(screen.getByText("LKR 18,000")).toBeInTheDocument();

    expect(getSubmitButton()).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: "New Booking",
      }),
    );

    expect(screen.getByLabelText("FULL NAME")).toHaveValue("");

    expect(screen.getByLabelText("EMAIL")).toHaveValue("");

    expect(
      screen.queryByText("Walk-in booking created successfully."),
    ).not.toBeInTheDocument();
  });

  it("Given card-on-site payment, when booking is created, then the backend pending payment status is preserved", async () => {
    let receivedPayload: unknown = null;

    server.use(
      http.post("*/bookings/walk-in", async ({ request }) => {
        receivedPayload = await request.json();

        return HttpResponse.json(
          {
            bookingId: bookingReference,
            bookingReference,
            guestId: null,
            guestAccountLinked: false,
            roomTypeId: "room-type-1",
            roomType: "Standard",
            checkInDate: "2026-10-08",
            checkOutDate: "2026-10-10",
            numGuests: 1,
            totalAmount: 18000,
            currency: "LKR",
            status: "PENDING",
            source: "WALK_IN",
            payment: {
              paymentId: "33333333-3333-4333-8333-333333333333",
              paymentMethod: "CARD_ON_SITE",
              paymentStatus: "PENDING",
              amount: 18000,
              paidAt: null,
            },
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<WalkInBookingScreen />);

    const user = await fillRequiredDetails();

    await user.click(screen.getByLabelText("PAYMENT METHOD"));

    await user.click(await screen.findByText("Card on site"));

    await user.click(getSubmitButton());

    expect(
      await screen.findByText(
        "Walk-in booking created successfully.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(receivedPayload).toMatchObject({
      payment: {
        paymentMethod: "CARD_ON_SITE",
      },
    });

    expect(screen.getAllByText("PENDING")).toHaveLength(2);

    expect(screen.queryByText("CONFIRMED")).not.toBeInTheDocument();
  });

  it("Given a backend booking conflict, when submitted, then the error is displayed without showing success", async () => {
    server.use(
      http.post("*/bookings/walk-in", () => {
        return HttpResponse.json(
          {
            message: "Room type is unavailable for the selected dates",
          },
          {
            status: 409,
          },
        );
      }),
    );

    renderWithProviders(<WalkInBookingScreen />);

    const user = await fillRequiredDetails();

    await user.click(getSubmitButton());

    expect(
      await screen.findByText(
        "Walk-in booking could not be created.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Room type is unavailable for the selected dates"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Walk-in booking created successfully."),
    ).not.toBeInTheDocument();
  });

  it("Given room inventory service failure, when the screen loads, then the inventory error is displayed", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          {
            message: "Room inventory service unavailable",
          },
          {
            status: 503,
          },
        );
      }),
    );

    renderWithProviders(<WalkInBookingScreen />);

    expect(
      await screen.findByText(
        "Unable to load room inventory.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("1 vacant now / 2 total"),
    ).not.toBeInTheDocument();
  });

  it("Given the walk-in booking screen, when accessibility is checked, then it has no detectable violations", async () => {
    const { container } = renderWithProviders(<WalkInBookingScreen />);

    await waitForRoomInventory();

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
