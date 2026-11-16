import { http, HttpResponse } from "msw";

import { screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  bookingFixtures,
  roomFixtures,
} from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { RoomChangeModal } from "./room-change-modal";

const checkedInBooking = bookingFixtures[1];

const receptionistId = "44444444-4444-4444-8444-444444444444";

async function searchForGuest() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("CURRENT GUEST / BOOKING"), "Nimali");

  await user.click(screen.getByRole("button", { name: "Search" }));

  return user;
}

async function selectCheckedInGuest() {
  const user = await searchForGuest();

  await user.click(
    await screen.findByRole(
      "button",
      { name: /Nimali Silva/i },
      { timeout: 8000 },
    ),
  );

  return user;
}

describe("RoomChangeModal additional branch coverage", () => {
  it("Given booking search fails, when searching, then the backend error is displayed", async () => {
    server.use(
      http.get("*/bookings/search", () =>
        HttpResponse.json(
          { message: "Booking search unavailable" },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<RoomChangeModal open={true} onClose={jest.fn()} />);

    await searchForGuest();

    expect(
      await screen.findByText(
        "Unable to search checked-in guests.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Booking search unavailable")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();
  });

  it("Given available-room lookup fails, when a booking is selected, then the error is shown without allowing confirmation", async () => {
    server.use(
      http.get("*/bookings/search", () =>
        HttpResponse.json([checkedInBooking]),
      ),

      http.get("*/room-changes/:bookingReference/available-rooms", () =>
        HttpResponse.json(
          { message: "Room lookup unavailable" },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(
      <RoomChangeModal
        open={true}
        onClose={jest.fn()}
        performedBy={receptionistId}
      />,
    );

    await selectCheckedInGuest();

    expect(
      await screen.findByText(
        "Unable to load available rooms.",
        {},
        { timeout: 8000 },
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Room lookup unavailable")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();
  });

  it("Given no reason or completion callback, when room change succeeds, then the optional fields are handled correctly", async () => {
    const availableRoom = {
      ...roomFixtures[0],
      roomNumber: "105",
    };

    const result = {
      status: "room_changed",
      bookingReference: checkedInBooking.bookingReference,
      previousRoomNumber: "102",
      roomNumber: "105",
      previousRoomStatus: "REQUIRES_CLEANING",
      roomStatus: "OCCUPIED",
      auditLogId: "55555555-5555-4555-8555-555555555555",
    };

    let receivedPayload: unknown = null;

    server.use(
      http.get("*/bookings/search", () =>
        HttpResponse.json([checkedInBooking]),
      ),

      http.get("*/room-changes/:bookingReference/available-rooms", () =>
        HttpResponse.json([availableRoom]),
      ),

      http.post("*/room-changes", async ({ request }) => {
        receivedPayload = await request.json();

        return HttpResponse.json(result);
      }),
    );

    const onClose = jest.fn();

    renderWithProviders(
      <RoomChangeModal
        open={true}
        onClose={onClose}
        performedBy={receptionistId}
      />,
    );

    const user = await selectCheckedInGuest();

    const roomSelector = await screen.findByRole(
      "combobox",
      {},
      { timeout: 8000 },
    );

    await user.click(roomSelector);

    await user.click(
      await screen.findByText(
        "105 — Standard · Floor 1",
        {},
        { timeout: 8000 },
      ),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    );

    await waitFor(
      () => {
        expect(onClose).toHaveBeenCalledTimes(1);
      },
      { timeout: 8000 },
    );

    expect(receivedPayload).toEqual({
      bookingReference: checkedInBooking.bookingReference,
      targetRoomNumber: "105",
      performedBy: receptionistId,
    });
  });
});
