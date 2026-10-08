import { http, HttpResponse } from "msw";

import { screen, waitFor } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { axe } from "jest-axe";

import {
  bookingFixtures,
  roomFixtures,
} from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { RoomChangeModal } from "./room-change-modal";

const checkedInBooking = bookingFixtures[1];

const receptionistId = "44444444-4444-4444-8444-444444444444";

const availableRoom = {
  ...roomFixtures[0],
  roomNumber: "105",
};

const roomChangeResult = {
  status: "room_changed" as const,
  bookingReference: checkedInBooking.bookingReference,
  previousRoomNumber: "102",
  roomNumber: "105",
  previousRoomStatus: "REQUIRES_CLEANING" as const,
  roomStatus: "OCCUPIED" as const,
  auditLogId: "55555555-5555-4555-8555-555555555555",
};

function mockCheckedInBooking() {
  server.use(
    http.get("*/bookings/search", () => {
      return HttpResponse.json([checkedInBooking]);
    }),
  );
}

function mockAvailableRooms(rooms = [availableRoom]) {
  server.use(
    http.get("*/room-changes/:bookingReference/available-rooms", () => {
      return HttpResponse.json(rooms);
    }),
  );
}

async function searchAndSelectBooking() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("CURRENT GUEST / BOOKING"), "Nimali");

  await user.click(
    screen.getByRole("button", {
      name: "Search",
    }),
  );

  const bookingButton = await screen.findByRole(
    "button",
    {
      name: /Nimali Silva/i,
    },
    {
      timeout: 8000,
    },
  );

  await user.click(bookingButton);

  return user;
}

async function selectAvailableRoom(user: ReturnType<typeof userEvent.setup>) {
  const roomSelector = await screen.findByRole(
    "combobox",
    {},
    {
      timeout: 8000,
    },
  );

  await waitFor(
    () => {
      expect(roomSelector).toBeEnabled();
    },
    {
      timeout: 8000,
    },
  );

  await user.click(roomSelector);

  await user.click(
    await screen.findByText(
      "105 — Standard · Floor 1",
      {},
      {
        timeout: 8000,
      },
    ),
  );
}

describe("RoomChangeModal", () => {
  it("Given the modal is opened, when no booking is selected, then search is available and confirmation is disabled", () => {
    const onClose = jest.fn();

    renderWithProviders(<RoomChangeModal open={true} onClose={onClose} />);

    expect(screen.getByText("↔ Room Change")).toBeInTheDocument();

    expect(
      screen.getByLabelText("CURRENT GUEST / BOOKING"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Search",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Cancel",
      }),
    ).toBeEnabled();
  });

  it("Given mixed booking statuses, when searched, then only checked-in bookings are selectable", async () => {
    server.use(
      http.get("*/bookings/search", () => {
        return HttpResponse.json(bookingFixtures);
      }),
    );

    renderWithProviders(<RoomChangeModal open={true} onClose={jest.fn()} />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText("CURRENT GUEST / BOOKING"), "Nimali");

    await user.click(
      screen.getByRole("button", {
        name: "Search",
      }),
    );

    expect(
      await screen.findByRole(
        "button",
        {
          name: /Nimali Silva/i,
        },
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /Kasun Perera/i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Guest name unavailable"),
    ).not.toBeInTheDocument();
  });

  it("Given no checked-in bookings, when searched, then an empty state is displayed", async () => {
    server.use(
      http.get("*/bookings/search", () => {
        return HttpResponse.json([bookingFixtures[0], bookingFixtures[2]]);
      }),
    );

    renderWithProviders(<RoomChangeModal open={true} onClose={jest.fn()} />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText("CURRENT GUEST / BOOKING"), "Test");

    await user.click(
      screen.getByRole("button", {
        name: "Search",
      }),
    );

    expect(
      await screen.findByText(
        "No checked-in booking matched this search.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();
  });

  it("Given no eligible vacant rooms, when a checked-in booking is selected, then room change remains unavailable", async () => {
    mockCheckedInBooking();
    mockAvailableRooms([]);

    renderWithProviders(
      <RoomChangeModal
        open={true}
        onClose={jest.fn()}
        performedBy={receptionistId}
      />,
    );

    await searchAndSelectBooking();

    expect(
      await screen.findByText(
        "No eligible vacant rooms are currently available.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();
  });

  it("Given an available room but no authenticated receptionist, when selected, then confirmation remains disabled", async () => {
    mockCheckedInBooking();
    mockAvailableRooms();

    let requestCount = 0;

    server.use(
      http.post("*/room-changes", () => {
        requestCount += 1;

        return HttpResponse.json(roomChangeResult);
      }),
    );

    renderWithProviders(<RoomChangeModal open={true} onClose={jest.fn()} />);

    const user = await searchAndSelectBooking();

    await selectAvailableRoom(user);

    expect(
      screen.getByText(
        "Room-change confirmation is waiting for authenticated Front Desk staff identity integration.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeDisabled();

    expect(requestCount).toBe(0);
  });

  it("Given valid booking, room, and authenticated receptionist, when room change succeeds, then the backend payload and callbacks are correct", async () => {
    mockCheckedInBooking();
    mockAvailableRooms();

    let receivedPayload: unknown = null;

    server.use(
      http.post("*/room-changes", async ({ request }) => {
        receivedPayload = await request.json();

        return HttpResponse.json(roomChangeResult);
      }),
    );

    const onClose = jest.fn();
    const onCompleted = jest.fn();

    renderWithProviders(
      <RoomChangeModal
        open={true}
        onClose={onClose}
        onCompleted={onCompleted}
        performedBy={receptionistId}
      />,
    );

    const user = await searchAndSelectBooking();

    await selectAvailableRoom(user);

    await user.type(
      screen.getByLabelText("REASON FOR ROOM CHANGE"),
      "  Guest requested quieter room  ",
    );

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Room Change",
    });

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    await waitFor(
      () => {
        expect(onCompleted).toHaveBeenCalledTimes(1);
      },
      {
        timeout: 8000,
      },
    );

    expect(receivedPayload).toEqual({
      bookingReference: checkedInBooking.bookingReference,
      targetRoomNumber: "105",
      performedBy: receptionistId,
      reason: "Guest requested quieter room",
    });

    expect(onCompleted).toHaveBeenCalledWith(roomChangeResult);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Given a backend room-change conflict, when confirmation is attempted, then the error is displayed and modal remains open", async () => {
    mockCheckedInBooking();
    mockAvailableRooms();

    server.use(
      http.post("*/room-changes", () => {
        return HttpResponse.json(
          {
            message: "Target room is no longer available",
          },
          {
            status: 409,
          },
        );
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

    const user = await searchAndSelectBooking();

    await selectAvailableRoom(user);

    await user.click(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    );

    expect(
      await screen.findByText(
        "Room change could not be completed.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Target room is no longer available"),
    ).toBeInTheDocument();

    expect(onClose).not.toHaveBeenCalled();

    expect(
      screen.getByRole("button", {
        name: "Confirm Room Change",
      }),
    ).toBeEnabled();
  });

  it("Given the modal is cancelled, when Cancel is clicked, then the close callback is invoked", async () => {
    const onClose = jest.fn();

    renderWithProviders(<RoomChangeModal open={true} onClose={onClose} />);

    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Given the initial modal, when accessibility is checked, then no detectable violations are reported", async () => {
    renderWithProviders(<RoomChangeModal open={true} onClose={jest.fn()} />);

    expect(screen.getByText("↔ Room Change")).toBeInTheDocument();

    // Ant Design renders Modal in a portal under document.body.
    const results = await axe(document.body);

    expect(results).toHaveNoViolations();
  });
});
