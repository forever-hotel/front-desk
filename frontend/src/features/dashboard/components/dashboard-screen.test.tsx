import { http, HttpResponse } from "msw";

import { screen, waitFor } from "@testing-library/react";

import { axe } from "jest-axe";

import {
  bookingFixtures,
  escalationFixtures,
  roomFixtures,
} from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { DashboardScreen } from "./dashboard-screen";

beforeEach(() => {
  server.use(
    http.get("*/bookings/arrivals", () => {
      return HttpResponse.json([]);
    }),

    http.get("*/bookings/departures", () => {
      return HttpResponse.json([]);
    }),
  );
});

describe("DashboardScreen", () => {
  it("Given real backend responses, when the dashboard loads, then counts and operational details are displayed", async () => {
    server.use(
      http.get("*/bookings/arrivals", () => {
        return HttpResponse.json([bookingFixtures[0]]);
      }),

      http.get("*/bookings/departures", () => {
        return HttpResponse.json([bookingFixtures[1]]);
      }),

      http.get("*/rooms/status", () => {
        return HttpResponse.json(roomFixtures);
      }),

      http.get("*/realtime/escalations", () => {
        return HttpResponse.json(escalationFixtures);
      }),
    );

    renderWithProviders(<DashboardScreen />);

    expect(
      await screen.findByText("Kasun Perera", {}, { timeout: 8000 }),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Nimali Silva", {}, { timeout: 8000 }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Room 201")).toBeInTheDocument();

    expect(await screen.findByText("202")).toBeInTheDocument();

    const arrivalsMetric = screen.getByText("Awaiting Check-In").closest("a");

    const departuresMetric = screen.getByText("Due for Check-Out").closest("a");

    const occupiedMetric = screen.getByText("Occupied Rooms").closest("a");

    const cleaningMetric = screen.getByRole("link", {
      name: /Needs Cleaning/i,
    });

    expect(arrivalsMetric).toHaveTextContent("1");

    expect(departuresMetric).toHaveTextContent("1");

    expect(occupiedMetric).toHaveTextContent("1");

    expect(cleaningMetric).toHaveTextContent("1");

    expect(arrivalsMetric).toHaveAttribute("href", "/check-in");

    expect(departuresMetric).toHaveAttribute("href", "/check-out");

    expect(occupiedMetric).toHaveAttribute("href", "/rooms");

    expect(screen.getByText("room cleaning")).toBeInTheDocument();

    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("Given empty backend responses, when the dashboard loads, then meaningful empty states are displayed", async () => {
    renderWithProviders(<DashboardScreen />);

    expect(
      await screen.findByText("No confirmed arrivals awaiting check-in today."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("No checked-in departures due today."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("No rooms available in the current inventory."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("No recent escalations."),
    ).toBeInTheDocument();

    const arrivalsMetric = screen.getByText("Awaiting Check-In").closest("a");

    expect(arrivalsMetric).toHaveTextContent("0");
  });

  it("Given backend failures, when requests fail, then errors are shown instead of misleading zero counts", async () => {
    server.use(
      http.get("*/bookings/arrivals", () => {
        return HttpResponse.json(
          {
            message: "Arrival service unavailable",
          },
          { status: 503 },
        );
      }),

      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          {
            message: "Room service unavailable",
          },
          { status: 503 },
        );
      }),
    );

    renderWithProviders(<DashboardScreen />);

    expect(
      await screen.findByText("Unable to load today's arrivals."),
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Unable to load room status."),
    ).toBeInTheDocument();

    const arrivalsMetric = screen.getByText("Awaiting Check-In").closest("a");

    const occupiedMetric = screen.getByText("Occupied Rooms").closest("a");

    expect(arrivalsMetric).toHaveTextContent("—");

    expect(occupiedMetric).toHaveTextContent("—");
  });

  it("Given the realtime connection is unavailable, when the dashboard loads, then REST fallback is communicated", async () => {
    renderWithProviders(<DashboardScreen />, {
      connectionState: "fallback",
    });

    expect(await screen.findByText("REST FALLBACK")).toBeInTheDocument();

    expect(screen.getByText("Room Status Quick View")).toBeInTheDocument();
  });

  it("Given the dashboard has loaded, when accessibility is checked, then it has no detectable violations", async () => {
    const { container } = renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(
        screen.getByText("No confirmed arrivals awaiting check-in today."),
      ).toBeInTheDocument();

      expect(
        screen.getByText("No checked-in departures due today."),
      ).toBeInTheDocument();

      expect(
        screen.getByText("No rooms available in the current inventory."),
      ).toBeInTheDocument();
    });

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
