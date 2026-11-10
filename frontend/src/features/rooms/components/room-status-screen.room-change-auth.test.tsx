import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useOptionalCentralAuthSession } from "@/features/auth/providers/central-auth-session-provider";
import {
  bookingFixtures,
  roomFixtures,
} from "../../../../tests/fixtures/fds-fixtures";
import { server } from "../../../../tests/mocks/server";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";
import { RoomStatusScreen } from "./room-status-screen";

jest.mock("@/features/auth/providers/central-auth-session-provider", () => ({
  useOptionalCentralAuthSession: jest.fn(),
}));

const mockSession = jest.mocked(useOptionalCentralAuthSession);
const receptionistId = "66666666-6666-4666-8666-666666666666";
const expiry = "2099-01-01T00:00:00.000Z";

beforeEach(() => {
  mockSession.mockReturnValue(null);
  server.use(http.get("*/rooms/status", () => HttpResponse.json(roomFixtures)));
});

afterEach(() => mockSession.mockReset());

describe("Room Change verified staff identity integration (#105)", () => {
  it("submits the authenticated receptionist UUID without a hardcoded actor", async () => {
    mockSession.mockReturnValue({
      status: "authenticated",
      session: {
        userId: receptionistId,
        displayName: "Reception Test",
        role: "RECEPTIONIST",
        expiresAt: expiry,
      },
      refreshSession: async () => undefined,
    });
    let receivedPayload: unknown;
    server.use(
      http.get("*/bookings/search", () =>
        HttpResponse.json([bookingFixtures[1]]),
      ),
      http.get("*/room-changes/:bookingReference/available-rooms", () =>
        HttpResponse.json([
          {
            ...roomFixtures[0],
            roomNumber: "105",
            roomTypeName: "Standard",
            status: "VACANT",
          },
        ]),
      ),
      http.post("*/room-changes", async ({ request }) => {
        receivedPayload = await request.json();
        return HttpResponse.json({
          status: "room_changed",
          bookingReference: bookingFixtures[1].bookingReference,
          previousRoomNumber: "102",
          roomNumber: "105",
          previousRoomStatus: "REQUIRES_CLEANING",
          roomStatus: "OCCUPIED",
          auditLogId: "55555555-5555-4555-8555-555555555555",
        });
      }),
    );

    renderWithProviders(<RoomStatusScreen />);
    const user = userEvent.setup();
    await screen.findByText("101");
    await user.click(screen.getByRole("button", { name: "Room Change" }));
    await user.type(screen.getByLabelText("CURRENT GUEST / BOOKING"), "Nimali");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.click(
      await screen.findByRole("button", { name: /Nimali Silva/i }),
    );

    const selector = await screen.findByRole("combobox", {}, { timeout: 8000 });
    await waitFor(() => expect(selector).toBeEnabled());
    await user.click(selector);
    await user.click(await screen.findByText("105 — Standard · Floor 1"));
    const confirm = screen.getByRole("button", { name: "Confirm Room Change" });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => {
      expect(receivedPayload).toEqual({
        bookingReference: bookingFixtures[1].bookingReference,
        targetRoomNumber: "105",
        performedBy: receptionistId,
      });
    });
  });

  it("disables Room Change for a manager who cannot write", async () => {
    mockSession.mockReturnValue({
      status: "authenticated",
      session: {
        userId: "77777777-7777-4777-8777-777777777777",
        displayName: "Manager Test",
        role: "MANAGER",
        expiresAt: expiry,
      },
      refreshSession: async () => undefined,
    });
    renderWithProviders(<RoomStatusScreen />);
    await screen.findByText("101");
    expect(screen.getByRole("button", { name: "Room Change" })).toBeDisabled();
  });

  it("disables Room Change when session identity is unavailable", async () => {
    mockSession.mockReturnValue({
      status: "unauthenticated",
      session: null,
      refreshSession: async () => undefined,
    });
    renderWithProviders(<RoomStatusScreen />);
    await screen.findByText("101");
    expect(screen.getByRole("button", { name: "Room Change" })).toBeDisabled();
  });
});
