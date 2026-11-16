import { http, HttpResponse } from "msw";

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { axe } from "jest-axe";

import { roomFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { RoomStatusScreen } from "./room-status-screen";

describe("RoomStatusScreen", () => {
  it.each([
    ["201", "Mark Cleaned", "Confirm room cleaned"],
    ["202", "Clear Maintenance", "Clear maintenance"],
  ])(
    "releases room %s only after confirmation",
    async (roomNumber, action, title) => {
      const user = userEvent.setup();
      const writes: unknown[] = [];
      server.use(
        http.get("*/rooms/status", () => HttpResponse.json(roomFixtures)),
        http.patch("*/rooms/:roomNumber/status", async ({ request }) => {
          writes.push(await request.json());
          return HttpResponse.json({
            roomNumber,
            status: "VACANT",
            lastClearedAt: "2026-11-04T12:00:00Z",
            updatedAt: "2026-11-04T12:00:00Z",
          });
        }),
      );
      renderWithProviders(<RoomStatusScreen />);
      await user.click(await screen.findByRole("button", { name: action }));
      expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
      expect(writes).toEqual([]);
      expect(
        screen.getByRole("button", { name: "Mark vacant" }),
      ).toBeDisabled();
      await user.click(screen.getByLabelText("ROOM NUMBER"));
      await user.click(await screen.findByText(new RegExp(`^${roomNumber} -`)));
      await user.type(
        screen.getByLabelText("COMMENT (OPTIONAL)"),
        "Work completed",
      );
      await user.click(screen.getByRole("button", { name: "Mark vacant" }));
      await waitFor(() =>
        expect(writes).toEqual([
          { targetStatus: "VACANT", notes: "Work completed" },
        ]),
      );
      await waitFor(() =>
        expect(
          screen
            .getByText(roomNumber, { selector: "strong" })
            .closest("article"),
        ).toHaveTextContent("VACANT"),
      );
      expect(screen.getByRole("button", { name: action })).toBeDisabled();
    },
  );

  it("cancels clearing maintenance without changing the room", async () => {
    const user = userEvent.setup();
    const write = jest.fn();
    server.use(
      http.get("*/rooms/status", () => HttpResponse.json(roomFixtures)),
      http.patch("*/rooms/:roomNumber/status", () => {
        write();
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<RoomStatusScreen />);
    await user.click(
      await screen.findByRole("button", {
        name: "Clear Maintenance",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(write).not.toHaveBeenCalled();
    expect(
      screen.getByText("202", { selector: "strong" }).closest("article"),
    ).toHaveTextContent("MAINT.");
  });

  it("keeps the release dialog open when the server rejects a stale transition", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/rooms/status", () => HttpResponse.json(roomFixtures)),
      http.patch("*/rooms/:roomNumber/status", () =>
        HttpResponse.json(
          { message: "Room is already occupied" },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<RoomStatusScreen />);
    await user.click(
      await screen.findByRole("button", { name: "Mark Cleaned" }),
    );
    await user.click(screen.getByLabelText("ROOM NUMBER"));
    await user.click(await screen.findByText(/^201 -/));
    await user.click(screen.getByRole("button", { name: "Mark vacant" }));
    expect(
      await screen.findByText("Room is already occupied"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Confirm room cleaned" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("201", { selector: "strong" }).closest("article"),
    ).toHaveTextContent("CLEANING");
    expect(
      screen.queryByRole("button", { name: /room 102/ }),
    ).not.toBeInTheDocument();
  });

  it("Given room-status data, when the screen loads, then all backend room states are displayed", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(roomFixtures);
      }),
    );

    renderWithProviders(<RoomStatusScreen />);

    expect(await screen.findByText("101")).toBeInTheDocument();

    expect(screen.getByText("102").closest("article")).toHaveTextContent(
      "OCCUPIED",
    );

    expect(screen.getByText("101").closest("article")).toHaveTextContent(
      "VACANT",
    );

    expect(
      screen.getByText("201", { selector: "strong" }).closest("article"),
    ).toHaveTextContent("CLEANING");

    expect(
      screen.getByText("202", { selector: "strong" }).closest("article"),
    ).toHaveTextContent("MAINT.");

    expect(screen.getByText("Vacant / Clean")).toBeInTheDocument();

    expect(screen.getByText("Occupied")).toBeInTheDocument();

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
