import { act, screen, waitFor } from "@testing-library/react";
import { jest } from "@jest/globals";
import { http, HttpResponse } from "msw";
import { axe } from "jest-axe";

import { escalationFixtures } from "../../../tests/fixtures/fds-fixtures";
import { server } from "../../../tests/mocks/server";
import { renderWithProviders } from "../../../tests/utils/render-with-providers";
import { queryKeys } from "@/lib/api/query-keys";

jest.doMock("next/navigation", () => ({
  usePathname: () => "/escalations",
}));

let Header: typeof import("./header").default;
let Sidebar: typeof import("./sidebar").default;

beforeAll(async () => {
  Header = (await import("./header")).default;
  Sidebar = (await import("./sidebar")).default;
});

function renderIndicators() {
  return renderWithProviders(
    <>
      <Sidebar isOpen onNavigate={() => {}} />
      <Header onMenuToggle={() => {}} />
      <main>
        <h1>Front Desk test page</h1>
      </main>
    </>,
  );
}

describe("Escalation header and sidebar indicators", () => {
  it("uses the backend count instead of the hardcoded number two", async () => {
    server.use(
      http.get("*/realtime/escalations", () =>
        HttpResponse.json([escalationFixtures[0]]),
      ),
    );

    renderIndicators();

    expect(
      await screen.findByRole("link", { name: "View 1 recent escalations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Escalations, 1 recent" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 RECENT ESCALATIONS")).toBeInTheDocument();
    expect(screen.queryByText("2 ESCALATED")).not.toBeInTheDocument();
  });

  it("shows zero rather than a fabricated badge when the snapshot is empty", async () => {
    server.use(http.get("*/realtime/escalations", () => HttpResponse.json([])));

    renderIndicators();

    expect(
      await screen.findByRole("link", { name: "View 0 recent escalations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Escalations, 0 recent" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("2 ESCALATED")).not.toBeInTheDocument();
  });

  it("updates both indicators from realtime's shared query cache", async () => {
    server.use(
      http.get("*/realtime/escalations", () =>
        HttpResponse.json([escalationFixtures[0]]),
      ),
    );

    const { queryClient } = renderIndicators();

    await screen.findByRole("link", { name: "View 1 recent escalations" });

    act(() => {
      queryClient.setQueryData(
        queryKeys.escalations.recent,
        escalationFixtures,
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "View 2 recent escalations" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Escalations, 2 recent" }),
      ).toBeInTheDocument();
    });
  });

  it("counts each task once even if an API snapshot repeats the same task", async () => {
    server.use(
      http.get("*/realtime/escalations", () =>
        HttpResponse.json([
          escalationFixtures[0],
          { ...escalationFixtures[0], eventId: "duplicate-event" },
          escalationFixtures[1],
        ]),
      ),
    );

    renderIndicators();

    expect(
      await screen.findByRole("link", { name: "View 2 recent escalations" }),
    ).toBeInTheDocument();
  });

  it("shows unavailable rather than zero on a backend error", async () => {
    server.use(
      http.get("*/realtime/escalations", () =>
        HttpResponse.json({ message: "Unavailable" }, { status: 503 }),
      ),
    );

    renderIndicators();

    expect(
      await screen.findByRole("link", {
        name: "View escalations: unavailable",
      }),
    ).toHaveTextContent("ESCALATIONS UNAVAILABLE");
    expect(
      screen.getByRole("link", { name: "Escalations, count unavailable" }),
    ).toBeInTheDocument();
  });

  it("has no detectable a11y violations with a populated count", async () => {
    server.use(
      http.get("*/realtime/escalations", () =>
        HttpResponse.json(escalationFixtures),
      ),
    );

    const { container } = renderIndicators();
    await screen.findByRole("link", { name: "View 2 recent escalations" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
