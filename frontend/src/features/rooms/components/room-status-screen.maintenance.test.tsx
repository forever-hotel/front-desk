import { http, HttpResponse } from "msw";

import { screen, waitFor, within } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { queryKeys } from "@/lib/api/query-keys";

import type { RoomStatusBoardItem } from "../types/room.type";

import { roomFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { RoomStatusScreen } from "./room-status-screen";

const maintenanceResult = {
  roomNumber: "101",
  previousStatus: "VACANT",
  status: "UNDER_MAINTENANCE",
  lastClearedAt: null,
  updatedAt: "2026-10-08T08:00:00.000Z",
};

beforeEach(() => {
  server.use(
    http.get("*/rooms/status", () => {
      return HttpResponse.json(roomFixtures);
    }),
  );
});

async function openMaintenanceModal() {
  const user = userEvent.setup();

  await screen.findByText("101", {}, { timeout: 8000 });

  const openButton = screen.getByRole("button", {
    name: "Mark Maintenance",
  });

  await waitFor(() => {
    expect(openButton).toBeEnabled();
  });

  await user.click(openButton);

  const dialog = await screen.findByRole("dialog", {
    name: "Mark Under Maintenance",
  });

  return { user, dialog };
}

async function selectVacantRoom(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.click(within(dialog).getByRole("combobox"));

  await user.click(
    await screen.findByText("101 — Standard", {}, { timeout: 8000 }),
  );

  expect(
    within(dialog).getByRole("button", {
      name: "Mark Under Maintenance",
    }),
  ).toBeEnabled();
}

describe("RoomStatusScreen maintenance workflows", () => {
  it("Given no vacant rooms, when the board loads, then maintenance allocation is disabled", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          roomFixtures.map((room) => ({
            ...room,
            status: "OCCUPIED",
          })),
        );
      }),
    );

    renderWithProviders(<RoomStatusScreen />);

    await screen.findByText("101", {}, { timeout: 8000 });

    expect(
      screen.getByRole("button", {
        name: "Mark Maintenance",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Room Change",
      }),
    ).toBeEnabled();
  });

  it("Given the maintenance modal, when opened and cancelled, then form state is reset", async () => {
    renderWithProviders(<RoomStatusScreen />);

    const { user, dialog } = await openMaintenanceModal();

    expect(
      within(dialog).getByRole("button", {
        name: "Mark Under Maintenance",
      }),
    ).toBeDisabled();

    await selectVacantRoom(user, dialog);

    await user.type(
      within(dialog).getByLabelText("MAINTENANCE REASON / NOTES"),
      "Air conditioner repair",
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: "Cancel",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Mark Maintenance",
      }),
    );

    const reopenedDialog = await screen.findByRole("dialog", {
      name: "Mark Under Maintenance",
    });

    expect(
      within(reopenedDialog).getByLabelText("MAINTENANCE REASON / NOTES"),
    ).toHaveValue("");

    expect(
      within(reopenedDialog).getByRole("button", {
        name: "Mark Under Maintenance",
      }),
    ).toBeDisabled();
  });

  it("Given a vacant room, when maintenance succeeds without notes, then the API payload and room cache are updated", async () => {
    let receivedPayload: unknown = null;
    let receivedRoomNumber: unknown = null;

    server.use(
      http.patch("*/rooms/:roomNumber/status", async ({ request, params }) => {
        receivedRoomNumber = params.roomNumber;
        receivedPayload = await request.json();

        return HttpResponse.json(maintenanceResult);
      }),
    );

    const { queryClient } = renderWithProviders(<RoomStatusScreen />);

    const { user, dialog } = await openMaintenanceModal();

    await selectVacantRoom(user, dialog);

    await user.click(
      within(dialog).getByRole("button", {
        name: "Mark Under Maintenance",
      }),
    );

    expect(
      await screen.findByText(
        "Room 101 was marked under maintenance.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(receivedRoomNumber).toBe("101");

    expect(receivedPayload).toEqual({
      targetStatus: "UNDER_MAINTENANCE",
    });

    const cachedRooms = queryClient.getQueryData<RoomStatusBoardItem[]>(
      queryKeys.rooms.status,
    );

    expect(
      cachedRooms?.find((room) => room.roomNumber === "101"),
    ).toMatchObject({
      status: "UNDER_MAINTENANCE",
      lastClearedAt: null,
      updatedAt: maintenanceResult.updatedAt,
    });

    expect(cachedRooms?.find((room) => room.roomNumber === "102")?.status).toBe(
      "OCCUPIED",
    );

    expect(
      screen.getByRole("button", {
        name: "Mark Maintenance",
      }),
    ).toBeDisabled();
  });

  it("Given maintenance notes with extra spaces, when submitted, then the notes are trimmed", async () => {
    let receivedPayload: unknown = null;

    server.use(
      http.patch("*/rooms/:roomNumber/status", async ({ request }) => {
        receivedPayload = await request.json();

        return HttpResponse.json(maintenanceResult);
      }),
    );

    renderWithProviders(<RoomStatusScreen />);

    const { user, dialog } = await openMaintenanceModal();

    await selectVacantRoom(user, dialog);

    await user.type(
      within(dialog).getByLabelText("MAINTENANCE REASON / NOTES"),
      "  Plumbing inspection  ",
    );

    await user.click(
      within(dialog).getByRole("button", {
        name: "Mark Under Maintenance",
      }),
    );

    expect(
      await screen.findByText(
        "Room 101 was marked under maintenance.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(receivedPayload).toEqual({
      targetStatus: "UNDER_MAINTENANCE",
      notes: "Plumbing inspection",
    });
  });

  it("Given the backend rejects a maintenance update, when submitted, then the error is shown and the room remains vacant", async () => {
    server.use(
      http.patch("*/rooms/:roomNumber/status", () => {
        return HttpResponse.json(
          {
            message: "Room status update rejected",
          },
          {
            status: 409,
          },
        );
      }),
    );

    const { queryClient } = renderWithProviders(<RoomStatusScreen />);

    const { user, dialog } = await openMaintenanceModal();

    await selectVacantRoom(user, dialog);

    await user.click(
      within(dialog).getByRole("button", {
        name: "Mark Under Maintenance",
      }),
    );

    expect(
      await screen.findByText(
        "Unable to mark this room under maintenance.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Room status update rejected")).toBeInTheDocument();

    const cachedRooms = queryClient.getQueryData<RoomStatusBoardItem[]>(
      queryKeys.rooms.status,
    );

    expect(cachedRooms?.find((room) => room.roomNumber === "101")?.status).toBe(
      "VACANT",
    );

    expect(
      screen.queryByText("Room 101 was marked under maintenance."),
    ).not.toBeInTheDocument();

    expect(
      within(dialog).getByRole("button", {
        name: "Cancel",
      }),
    ).toBeEnabled();
  });

  it("Given the room-status board, when Room Change is clicked, then the room-change dialog opens", async () => {
    renderWithProviders(<RoomStatusScreen />);

    const user = userEvent.setup();

    await screen.findByText("101", {}, { timeout: 8000 });

    await user.click(
      screen.getByRole("button", {
        name: "Room Change",
      }),
    );

    expect(
      await screen.findByText("↔ Room Change", {}, { timeout: 8000 }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: "Cancel",
      }),
    );
  });
});
