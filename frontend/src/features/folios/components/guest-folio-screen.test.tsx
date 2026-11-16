import { http, HttpResponse } from "msw";

import { screen } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { axe } from "jest-axe";

import { bookingFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { GuestFolioScreen } from "./guest-folio-screen";

const checkedInBooking = bookingFixtures[1];

const folioFixture = {
  bookingReference: checkedInBooking.bookingReference,
  roomNumber: "102",
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

async function searchGuest() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("SEARCH GUEST / BOOKING"), "Nimali");

  await user.click(
    screen.getByRole("button", {
      name: "Load Folio",
    }),
  );
}

describe("GuestFolioScreen", () => {
  it("Given the folio screen, when first opened, then a guest search is available", () => {
    renderWithProviders(<GuestFolioScreen />);

    expect(screen.getByText("Guest Folio")).toBeInTheDocument();

    expect(screen.getByLabelText("SEARCH GUEST / BOOKING")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Load Folio",
      }),
    ).toBeInTheDocument();
  });

  it("Given a checked-in guest with an active folio, when searched, then itemised charges are displayed", async () => {
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

    renderWithProviders(<GuestFolioScreen />);

    await searchGuest();

    expect(
      await screen.findByText("Room accommodation", {}, { timeout: 8000 }),
    ).toBeInTheDocument();

    expect(screen.getByText("Restaurant charges")).toBeInTheDocument();

    expect(screen.getByText("STAY SUMMARY")).toBeInTheDocument();

    expect(screen.getByText("ITEMISED CHARGES")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Print Folio",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: /Process Check-Out/i,
      }),
    ).toBeDisabled();
  });

  it("Given no matching checked-in booking, when searched, then the empty state is shown", async () => {
    server.use(
      http.get("*/bookings/search", () => {
        return HttpResponse.json([bookingFixtures[0]]);
      }),
    );

    renderWithProviders(<GuestFolioScreen />);

    await searchGuest();

    expect(
      await screen.findByText(
        "No active checked-in stay matched this search.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it("Given the folio API is unavailable, when the guest is selected, then an error is displayed", async () => {
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

    renderWithProviders(<GuestFolioScreen />);

    await searchGuest();

    expect(
      await screen.findByText(
        "Folio temporarily unavailable",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();
  });

  it("Given the initial folio screen, when accessibility is checked, then it has no detectable violations", async () => {
    const { container } = renderWithProviders(<GuestFolioScreen />);

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
