import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { escalationFixtures } from "../../../../tests/fixtures/fds-fixtures";
import { server } from "../../../../tests/mocks/server";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";
import { EscalationsScreen } from "./escalations-screen";

describe("Escalations recovery states", () => {
  it("does not report an empty snapshot when loading actually failed", async () => {
    server.use(
      http.get("*/realtime/escalations", () =>
        HttpResponse.json({ message: "Unavailable" }, { status: 503 }),
      ),
    );

    renderWithProviders(<EscalationsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load recent escalations",
    );
    expect(
      screen.queryByText("No recent escalations."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry loading escalations" }),
    ).toBeInTheDocument();
  });

  it("retries a failed query and renders the recovered escalation snapshot", async () => {
    let requests = 0;
    server.use(
      http.get("*/realtime/escalations", () => {
        requests += 1;
        if (requests === 1) {
          return HttpResponse.json({ message: "Unavailable" }, { status: 503 });
        }
        return HttpResponse.json(escalationFixtures);
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<EscalationsScreen />);

    await user.click(
      await screen.findByRole("button", { name: "Retry loading escalations" }),
    );

    expect(await screen.findByText("ROOM_CLEANING")).toBeInTheDocument();
    expect(screen.getByText("2 recent escalated tasks")).toBeInTheDocument();
  });
});
