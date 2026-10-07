import { http, HttpResponse } from "msw";

import { screen } from "@testing-library/react";

import { axe } from "jest-axe";

import { escalationFixtures } from "../../../../tests/fixtures/fds-fixtures";

import { server } from "../../../../tests/mocks/server";

import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { EscalationsScreen } from "./escalations-screen";

describe("EscalationsScreen", () => {
  it("Given escalation events, when the screen loads, then WKMS escalation details are displayed", async () => {
    server.use(
      http.get("*/realtime/escalations", () => {
        return HttpResponse.json(escalationFixtures);
      }),
    );

    renderWithProviders(<EscalationsScreen />);

    expect(await screen.findByText("ROOM_CLEANING")).toBeInTheDocument();

    expect(screen.getByText("EXTRA_TOWELS")).toBeInTheDocument();

    expect(screen.getByText("Room 201")).toBeInTheDocument();

    expect(screen.getByText("Room 102")).toBeInTheDocument();

    expect(screen.getByText("HIGH")).toBeInTheDocument();

    expect(screen.getByText("NORMAL")).toBeInTheDocument();

    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("Given there are no escalations, when the screen loads, then an empty state is displayed", async () => {
    server.use(
      http.get("*/realtime/escalations", () => {
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<EscalationsScreen />);

    expect(
      await screen.findByText("No recent escalations."),
    ).toBeInTheDocument();
  });

  it("Given realtime is unavailable, when the screen renders, then fallback status is displayed", async () => {
    server.use(
      http.get("*/realtime/escalations", () => {
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<EscalationsScreen />, {
      connectionState: "fallback",
    });

    expect(await screen.findByText("REST FALLBACK")).toBeInTheDocument();
  });

  it("Given the escalation endpoint fails, when the screen loads, then an accessible error is shown", async () => {
    server.use(
      http.get("*/realtime/escalations", () => {
        return HttpResponse.json(
          {
            message: "Escalation service unavailable",
          },
          {
            status: 503,
          },
        );
      }),
    );

    renderWithProviders(<EscalationsScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load recent escalations.",
    );
  });

  it("Given the escalation screen, when accessibility is checked, then it has no detectable violations", async () => {
    server.use(
      http.get("*/realtime/escalations", () => {
        return HttpResponse.json(escalationFixtures);
      }),
    );

    const { container } = renderWithProviders(<EscalationsScreen />);

    await screen.findByText("ROOM_CLEANING");

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
