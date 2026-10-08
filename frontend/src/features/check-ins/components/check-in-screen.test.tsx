import { http, HttpResponse } from "msw";

import { screen } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import {
  bookingFixtures,
  roomFixtures,
} from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { CheckInScreen } from "./check-in-screen";

const confirmedBooking = bookingFixtures[0];

const receptionistId = "44444444-4444-4444-8444-444444444444";

const vacantDeluxeRooms = [
  ...roomFixtures.filter((room) => room.roomNumber !== "102"),
  {
    ...roomFixtures[1],
    status: "VACANT" as const,
  },
];

function mockBookingAndRooms(
  bookings = [confirmedBooking],
  rooms = roomFixtures,
) {
  server.use(
    http.get("*/bookings/search", () => {
      return HttpResponse.json(bookings);
    }),

    http.get("*/rooms/status", () => {
      return HttpResponse.json(rooms);
    }),
  );
}

async function searchForBooking(query = "Kasun") {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("SEARCH QUERY"), query);

  await user.click(
    screen.getByRole("button", {
      name: "Search",
    }),
  );

  return user;
}

async function waitForSelectedBooking() {
  return screen.findByRole(
    "checkbox",
    {
      name: /Physical document verified at desk/i,
    },
    {
      timeout: 8000,
    },
  );
}

async function prepareVerifiedRoomAssignment() {
  const user = await searchForBooking();

  const verificationCheckbox = await waitForSelectedBooking();

  await user.click(verificationCheckbox);

  const assignButton = await screen.findByRole(
    "button",
    {
      name: "Assign",
    },
    {
      timeout: 8000,
    },
  );

  await user.click(assignButton);

  expect(
    screen.getByRole("button", {
      name: "Assigned",
    }),
  ).toBeEnabled();

  return user;
}

describe("CheckInScreen", () => {
  it("Given the initial screen, when opened, then booking search and the four workflow steps are available", () => {
    renderWithProviders(<CheckInScreen />);

    expect(
      screen.getByRole("heading", {
        name: "Guest Check-In",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("STEP 1 — FIND BOOKING")).toBeInTheDocument();

    expect(screen.getByText("STEP 2 — ID VERIFICATION")).toBeInTheDocument();

    expect(screen.getByText("STEP 3 — ROOM ASSIGNMENT")).toBeInTheDocument();

    expect(screen.getByText("STEP 4 — CONFIRM CHECK-IN")).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Search",
      }),
    ).toBeDisabled();

    expect(
      screen.getByText("Complete the previous steps to confirm check-in."),
    ).toBeInTheDocument();
  });

  it("Given bookings that are not confirmed, when searched, then they cannot proceed to check-in", async () => {
    mockBookingAndRooms([bookingFixtures[1], bookingFixtures[2]]);

    renderWithProviders(<CheckInScreen />);

    await searchForBooking("Nimali");

    expect(
      await screen.findByText(
        "No confirmed booking matched this search.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("checkbox", {
        name: /Physical document verified at desk/i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /Confirm Check-In & Activate FOSS/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("Given a confirmed booking, when identity is verified but no compatible vacant room exists, then room assignment is blocked", async () => {
    mockBookingAndRooms([confirmedBooking], roomFixtures);

    renderWithProviders(<CheckInScreen />);

    const user = await searchForBooking();

    const verificationCheckbox = await waitForSelectedBooking();

    expect(
      screen.getByText(
        "Complete identity verification before assigning a room.",
      ),
    ).toBeInTheDocument();

    await user.click(verificationCheckbox);

    expect(
      await screen.findByText(
        "No vacant Deluxe rooms are currently available.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Assign",
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Confirm Check-In & Activate FOSS/i,
      }),
    ).toBeDisabled();
  });

  it("Given a verified booking and compatible room, when receptionist identity is unavailable, then check-in submission remains disabled", async () => {
    mockBookingAndRooms([confirmedBooking], vacantDeluxeRooms);

    let checkInRequestCount = 0;

    server.use(
      http.post("*/check-in", () => {
        checkInRequestCount += 1;

        return HttpResponse.json({
          status: "checked_in",
        });
      }),
    );

    renderWithProviders(<CheckInScreen />);

    await prepareVerifiedRoomAssignment();

    expect(
      screen.getByText(
        "Check-in submission is waiting for authenticated receptionist identity integration.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Confirm Check-In & Activate FOSS/i,
      }),
    ).toBeDisabled();

    expect(checkInRequestCount).toBe(0);
  });

  it("Given an authenticated receptionist, verified guest and vacant compatible room, when check-in succeeds, then FOSS status and registration-card printing are displayed", async () => {
    mockBookingAndRooms([confirmedBooking], vacantDeluxeRooms);

    let receivedCheckInPayload: unknown = null;
    let receivedPrintPayload: unknown = null;

    server.use(
      http.post("*/check-in", async ({ request }) => {
        receivedCheckInPayload = await request.json();

        return HttpResponse.json({
          status: "checked_in",
          bookingReference: confirmedBooking.bookingReference,
          roomNumber: "102",
          bookingStatus: "CHECKED_IN",
          roomStatus: "OCCUPIED",
          verification: {
            verificationId: "55555555-5555-4555-8555-555555555555",
            documentType: "NIC",
            verificationMethod: "PHYSICAL_DOCUMENT",
            verifiedBy: receptionistId,
            verifiedAt: "2026-10-08T06:00:00.000Z",
          },
          auditLogId: "66666666-6666-4666-8666-666666666666",
          fossSession: {
            status: "ACTIVATED",
            sessionReference: "foss-test-1",
            validUntilDate: "2026-10-09",
          },
        });
      }),

      http.post("*/check-in/:bookingReference/print", async ({ request }) => {
        receivedPrintPayload = await request.json();

        return HttpResponse.json({
          status: "accepted",
          documentType: "REGISTRATION_CARD",
          bookingReference: confirmedBooking.bookingReference,
          roomNumber: "102",
          printJobReference: "print-job-test-1",
        });
      }),
    );

    renderWithProviders(<CheckInScreen performedBy={receptionistId} />);

    const user = await prepareVerifiedRoomAssignment();

    const confirmButton = screen.getByRole("button", {
      name: /Confirm Check-In & Activate FOSS/i,
    });

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(
      await screen.findByText(
        "Check-in completed. Room 102 is now occupied.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(receivedCheckInPayload).toEqual({
      bookingReference: confirmedBooking.bookingReference,
      roomNumber: "102",
      verification: {
        documentType: "NIC",
        verificationMethod: "PHYSICAL_DOCUMENT",
        verifiedBy: receptionistId,
      },
    });

    expect(
      screen.getByText("FOSS guest session activated."),
    ).toBeInTheDocument();

    expect(confirmButton).toBeDisabled();

    const printButton = screen.getByRole("button", {
      name: "Print Registration Card",
    });

    expect(printButton).toBeEnabled();

    await user.click(printButton);

    expect(
      await screen.findByText(
        "Registration-card print request accepted.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(receivedPrintPayload).toEqual({
      documentType: "REGISTRATION_CARD",
    });
  });

  it("Given a backend room conflict, when check-in is submitted, then the error is displayed without showing success", async () => {
    mockBookingAndRooms([confirmedBooking], vacantDeluxeRooms);

    server.use(
      http.post("*/check-in", () => {
        return HttpResponse.json(
          {
            message: "Selected room is not available",
          },
          {
            status: 409,
          },
        );
      }),
    );

    renderWithProviders(<CheckInScreen performedBy={receptionistId} />);

    const user = await prepareVerifiedRoomAssignment();

    await user.click(
      screen.getByRole("button", {
        name: /Confirm Check-In & Activate FOSS/i,
      }),
    );

    expect(
      await screen.findByText(
        "Guest check-in could not be completed.",
        {},
        {
          timeout: 8000,
        },
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Selected room is not available"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Check-in completed. Room 102 is now occupied."),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Print Registration Card",
      }),
    ).toBeDisabled();
  });
});
