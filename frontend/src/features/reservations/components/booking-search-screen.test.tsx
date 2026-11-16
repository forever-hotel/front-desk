import { http, HttpResponse } from "msw";

import { screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { axe } from "jest-axe";

import { bookingFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { BookingSearchScreen } from "./booking-search-screen";

describe("BookingSearchScreen", () => {
  it("Given recent bookings, when the screen loads, then the booking records are displayed", async () => {
    server.use(
      http.get("*/bookings/recent", () => {
        return HttpResponse.json({
          value: bookingFixtures,
          count: bookingFixtures.length,
        });
      }),
    );

    renderWithProviders(<BookingSearchScreen />);

    expect(await screen.findByText("Kasun Perera")).toBeInTheDocument();

    expect(screen.getByText("Nimali Silva")).toBeInTheDocument();

    expect(screen.getByText("Guest name unavailable")).toBeInTheDocument();

    expect(screen.getByText("No email available")).toBeInTheDocument();

    expect(screen.getByText("Confirmed")).toBeInTheDocument();

    expect(screen.getByText("Checked In")).toBeInTheDocument();

    expect(screen.getByText("Checked Out")).toBeInTheDocument();
  });

  it("Given a booking query, when Search is submitted, then backend search results replace recent bookings", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("*/bookings/recent", () => {
        return HttpResponse.json({
          value: bookingFixtures,
          count: bookingFixtures.length,
        });
      }),

      http.get("*/bookings/search", ({ request }) => {
        const url = new URL(request.url);

        if (url.searchParams.get("query") !== "Kasun") {
          return HttpResponse.json([]);
        }

        return HttpResponse.json([bookingFixtures[0]]);
      }),
    );

    renderWithProviders(<BookingSearchScreen />);

    await screen.findByText("Nimali Silva");

    await user.type(screen.getByLabelText("SEARCH QUERY"), "Kasun");

    await user.click(
      screen.getByRole("button", {
        name: "Search",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Kasun Perera")).toBeInTheDocument();

      expect(screen.queryByText("Nimali Silva")).not.toBeInTheDocument();
    });
  });

  it("Given an empty recent-booking response, when loaded, then an empty state is shown", async () => {
    server.use(
      http.get("*/bookings/recent", () => {
        return HttpResponse.json({
          value: [],
          count: 0,
        });
      }),
    );

    renderWithProviders(<BookingSearchScreen />);

    expect(
      await screen.findByText("No recent bookings available."),
    ).toBeInTheDocument();
  });

  it("Given the booking screen, when accessibility is checked, then it has no detectable violations", async () => {
    server.use(
      http.get("*/bookings/recent", () => {
        return HttpResponse.json({
          value: bookingFixtures,
          count: bookingFixtures.length,
        });
      }),
    );

    const { container } = renderWithProviders(<BookingSearchScreen />);

    await screen.findByText("Kasun Perera");

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
