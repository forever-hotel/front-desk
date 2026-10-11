import { http, HttpResponse } from "msw";

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { server } from "../../../../tests/mocks/server";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { AuditLogScreen } from "./audit-log-screen";

const fixture = {
  logId: "11111111-1111-4111-8111-111111111111",
  eventCategory: "FRONT_DESK_OPERATION",
  actorType: "STAFF",
  staffUserId: "22222222-2222-4222-8222-222222222222",
  action: "CHECK_IN",
  entityType: "BOOKING",
  entityId: "33333333-3333-4333-8333-333333333333",
  details: { roomNumber: "101", token: "[REDACTED]" },
  createdAt: "2026-10-08T10:00:00.000Z",
};

function mockList(rows: Array<typeof fixture>) {
  server.use(http.get("*/audit-logs", () => HttpResponse.json(rows)));
}

describe("AuditLogScreen", () => {
  it("renders backend audit records without edit or delete controls", async () => {
    mockList([fixture]);
    renderWithProviders(<AuditLogScreen />);

    const table = await screen.findByRole("table", {
      name: /audit log records/i,
    });
    expect(within(table).getByText("CHECK_IN")).toBeInTheDocument();
    expect(within(table).getByText("FRONT DESK OPERATION")).toBeInTheDocument();
    expect(within(table).getByText(fixture.staffUserId)).toBeInTheDocument();
    expect(screen.getByText("READ ONLY")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("applies only supported event category and exact action filters", async () => {
    const user = userEvent.setup();
    const received: string[] = [];
    server.use(
      http.get("*/audit-logs", ({ request }) => {
        received.push(new URL(request.url).search);
        return HttpResponse.json([fixture]);
      }),
    );
    renderWithProviders(<AuditLogScreen />);
    await screen.findByText("CHECK_IN");

    await user.selectOptions(
      screen.getByLabelText("EVENT CATEGORY"),
      "FRONT_DESK_OPERATION",
    );
    await user.type(screen.getByLabelText("ACTION"), " check_in ");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(
        received.some((search) => {
          const params = new URLSearchParams(search);
          return (
            params.get("eventCategory") === "FRONT_DESK_OPERATION" &&
            params.get("action") === "CHECK_IN"
          );
        }),
      ).toBe(true);
    });
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("clears filters and restores the first page", async () => {
    const user = userEvent.setup();
    const queries: string[] = [];
    server.use(
      http.get("*/audit-logs", ({ request }) => {
        const params = new URL(request.url).searchParams;
        queries.push(params.get("action") ?? "");
        return HttpResponse.json([fixture]);
      }),
    );
    renderWithProviders(<AuditLogScreen />);
    await screen.findByText("CHECK_IN");
    await user.type(screen.getByLabelText("ACTION"), "CHECK_OUT");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(queries).toContain("CHECK_OUT"));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("ACTION")).toHaveValue("");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("shows the backend-provided detail record and closes it", async () => {
    const user = userEvent.setup();
    mockList([fixture]);
    server.use(
      http.get("*/audit-logs/:logId", ({ params }) => {
        expect(params.logId).toBe(fixture.logId);
        return HttpResponse.json(fixture);
      }),
    );
    renderWithProviders(<AuditLogScreen />);
    await screen.findByText("CHECK_IN");
    await user.click(
      screen.getByRole("button", {
        name: `View details for audit log ${fixture.logId}`,
      }),
    );

    const details = await screen.findByRole("region", {
      name: "Audit Event Details",
    });
    expect(
      await within(details).findByText(/"roomNumber": "101"/),
    ).toBeInTheDocument();
    expect(
      within(details).getByText(/"token": "\[REDACTED\]"/),
    ).toBeInTheDocument();
    await user.click(
      within(details).getByRole("button", { name: "Close details" }),
    );
    expect(
      screen.queryByRole("region", { name: "Audit Event Details" }),
    ).not.toBeInTheDocument();
  });

  it("paginates by limit and offset without assuming a total count", async () => {
    const user = userEvent.setup();
    const offsets: number[] = [];
    const firstPage = Array.from({ length: 25 }, (_, index) => ({
      ...fixture,
      logId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    }));
    server.use(
      http.get("*/audit-logs", ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset"));
        offsets.push(offset);
        return HttpResponse.json(offset === 0 ? firstPage : [fixture]);
      }),
    );
    renderWithProviders(<AuditLogScreen />);
    await screen.findByText("Page 1");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(offsets).toContain(25));
    expect(screen.getByText("Page 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("displays the empty state when the API returns no rows", async () => {
    mockList([]);
    renderWithProviders(<AuditLogScreen />);
    expect(
      await screen.findByText("No audit records found for these filters."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("shows an accessible error and allows retry", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(
      http.get("*/audit-logs", () => {
        attempts++;
        return attempts === 1
          ? HttpResponse.json({ message: "Unavailable" }, { status: 503 })
          : HttpResponse.json([fixture]);
      }),
    );
    renderWithProviders(<AuditLogScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load audit logs",
    );
    await user.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(await screen.findByText("CHECK_IN")).toBeInTheDocument();
  });

  it("handles an unavailable detail record without hiding the list", async () => {
    const user = userEvent.setup();
    mockList([fixture]);
    server.use(
      http.get("*/audit-logs/:logId", () =>
        HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );
    renderWithProviders(<AuditLogScreen />);
    await screen.findByText("CHECK_IN");
    await user.click(
      screen.getByRole("button", {
        name: `View details for audit log ${fixture.logId}`,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to retrieve this audit record",
    );
    expect(screen.getByText("CHECK_IN")).toBeInTheDocument();
  });

  it("passes an automated accessibility check with records and filters", async () => {
    mockList([fixture]);
    const { container } = renderWithProviders(<AuditLogScreen />);
    await screen.findByText("CHECK_IN");
    expect(await axe(container)).toHaveNoViolations();
  });
});
