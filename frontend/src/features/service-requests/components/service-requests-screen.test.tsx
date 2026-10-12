import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { server } from "../../../../tests/mocks/server";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";
import { ServiceRequestsScreen } from "./service-requests-screen";

const bookingReference = "11111111-1111-4111-8111-111111111111";
const receptionistId = "22222222-2222-4222-8222-222222222222";

const checkedInBooking = {
  bookingId: bookingReference,
  bookingReference,
  guestName: "Demo Guest",
  email: "guest@example.invalid",
  phone: null,
  roomType: "Deluxe",
  checkInDate: "2026-10-09",
  checkOutDate: "2026-10-12",
  status: "CHECKED_IN",
};

function mockSearch(status = "CHECKED_IN") {
  server.use(
    http.get("*/bookings/search", () =>
      HttpResponse.json([{ ...checkedInBooking, status }]),
    ),
  );
}

async function selectCheckedInBooking(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText("Find a checked-in booking"), "Demo");
  await user.click(screen.getByRole("button", { name: "Search booking" }));
  await user.click(
    await screen.findByRole("button", {
      name: "Select booking for Demo Guest",
    }),
  );
}

describe("ServiceRequestsScreen", () => {
  it("shows the form and prevents submission without a receptionist session", () => {
    renderWithProviders(<ServiceRequestsScreen />);

    expect(
      screen.getByRole("heading", { name: "Guest Service Requests" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Authenticated receptionist identity is required"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create service request" }),
    ).toBeDisabled();
  });

  it("finds checked-in bookings and ignores other booking statuses", async () => {
    const user = userEvent.setup();
    mockSearch("CONFIRMED");

    renderWithProviders(<ServiceRequestsScreen performedBy={receptionistId} />);

    await user.type(screen.getByLabelText("Find a checked-in booking"), "Demo");
    await user.click(screen.getByRole("button", { name: "Search booking" }));

    expect(
      await screen.findByText("No checked-in bookings matched this search."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select booking for Demo Guest" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create service request" }),
    ).toBeDisabled();
  });

  it("sends the chosen booking, category, and receptionist ID and shows backend task details", async () => {
    const user = userEvent.setup();
    let requestBody: unknown = null;
    let callCount = 0;
    mockSearch();

    server.use(
      http.post("*/service-requests", async ({ request }) => {
        callCount += 1;
        requestBody = await request.json();
        return HttpResponse.json(
          {
            status: "created",
            bookingReference,
            roomNumber: "DEMO101",
            task: {
              taskId: "33333333-3333-4333-8333-333333333333",
              roomNumber: "DEMO101",
              category: "EXTRA_TOWELS",
              status: "PENDING",
              priority: "NORMAL",
            },
          },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<ServiceRequestsScreen performedBy={receptionistId} />);
    await selectCheckedInBooking(user);
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "  Two extra towels  ",
    );
    await user.click(
      screen.getByRole("button", { name: "Create service request" }),
    );

    expect(
      await screen.findByText("Service request created"),
    ).toBeInTheDocument();
    expect(screen.getByText("Room: DEMO101")).toBeInTheDocument();
    expect(screen.getByText("Task status: PENDING")).toBeInTheDocument();
    expect(requestBody).toEqual({
      bookingReference,
      category: "EXTRA_TOWELS",
      description: "Two extra towels",
      performedBy: receptionistId,
    });
    expect(
      screen.getByRole("button", { name: "Create service request" }),
    ).toBeDisabled();
    expect(callCount).toBe(1);
  });

  it("shows a backend conflict and does not claim the request succeeded", async () => {
    const user = userEvent.setup();
    mockSearch();
    server.use(
      http.post("*/service-requests", () =>
        HttpResponse.json(
          {
            message:
              "Service requests can only be created for a checked-in guest",
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<ServiceRequestsScreen performedBy={receptionistId} />);
    await selectCheckedInBooking(user);
    await user.click(
      screen.getByRole("button", { name: "Create service request" }),
    );

    expect(
      await screen.findByText(
        "Service requests can only be created for a checked-in guest",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Service request created"),
    ).not.toBeInTheDocument();
  });

  it("provides the accessible search and request form", async () => {
    const { container } = renderWithProviders(
      <ServiceRequestsScreen performedBy={receptionistId} />,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText("Find a checked-in booking"),
      ).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
