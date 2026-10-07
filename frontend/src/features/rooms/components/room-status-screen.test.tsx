import { http, HttpResponse } from "msw";

import { screen } from "@testing-library/react";

import { axe } from "jest-axe";

import { roomFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { RoomStatusScreen } from "./room-status-screen";

describe("RoomStatusScreen", () => {
  it("Given room-status data, when the screen loads, then all backend room states are displayed", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(roomFixtures);
      }),
    );

    renderWithProviders(<RoomStatusScreen />);

    expect(await screen.findByText("101")).toBeInTheDocument();

    expect(screen.getByText("102")).toBeInTheDocument();

    expect(screen.getByText("201")).toBeInTheDocument();

    expect(screen.getByText("202")).toBeInTheDocument();

    /*
     * Vacant and Occupied appear twice intentionally:
     * once in the summary cards and once in the room table.
     */
    expect(screen.getAllByText("Vacant")).toHaveLength(2);

    expect(screen.getAllByText("Occupied")).toHaveLength(2);

    expect(screen.getByText("Requires Cleaning")).toBeInTheDocument();

    expect(screen.getByText("Under Maintenance")).toBeInTheDocument();

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("Given realtime is reconnecting, when the screen renders, then reconnecting status is communicated", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<RoomStatusScreen />, {
      connectionState: "connecting",
    });

    expect(
      await screen.findByText("No rooms were returned."),
    ).toBeInTheDocument();

    expect(screen.getByText("RECONNECTING")).toBeInTheDocument();
  });

  it("Given realtime is unavailable, when the screen renders, then REST fallback status is communicated", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<RoomStatusScreen />, {
      connectionState: "fallback",
    });

    expect(
      await screen.findByText("No rooms were returned."),
    ).toBeInTheDocument();

    expect(screen.getByText("REST FALLBACK")).toBeInTheDocument();
  });

  it("Given the room endpoint fails, when the screen loads, then an accessible error is shown", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          {
            message: "Room service unavailable",
          },
          {
            status: 503,
          },
        );
      }),
    );

    renderWithProviders(<RoomStatusScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load the room-status board.",
    );
  });

  it("Given the room-status screen, when accessibility is checked, then it has no detectable violations", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(roomFixtures);
      }),
    );

    const { container } = renderWithProviders(<RoomStatusScreen />);

    await screen.findByText("101");

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
