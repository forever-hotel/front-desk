import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";
import { UNAUTHORIZED_EVENT } from "@/lib/api/api-client";
import { CENTRAL_AUTH_SESSION_PATH } from "../api/central-auth-session.api";
import {
  CentralAuthSessionProvider,
  useCentralAuthSession,
} from "./central-auth-session-provider";

const session = {
  userId: "66666666-6666-4666-8666-666666666666",
  displayName: "Reception Test",
  role: "RECEPTIONIST",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

function SessionIndicator() {
  const current = useCentralAuthSession();
  return (
    <div>
      <span data-testid="session-state">{current.status}</span>
      {current.status === "authenticated" && (
        <span>{current.session.displayName}</span>
      )}
    </div>
  );
}

describe("CentralAuthSessionProvider", () => {
  it("loads a session and immediately discards it on a backend 401 event", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json(session),
      ),
    );

    render(
      <CentralAuthSessionProvider>
        <SessionIndicator />
      </CentralAuthSessionProvider>,
    );

    expect(await screen.findByText("Reception Test")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId("session-state")).toHaveTextContent(
        "unauthenticated",
      );
    });
    expect(screen.queryByText("Reception Test")).not.toBeInTheDocument();
  });

  it("fails closed when the session endpoint is not implemented", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );

    render(
      <CentralAuthSessionProvider>
        <SessionIndicator />
      </CentralAuthSessionProvider>,
    );

    expect(await screen.findByTestId("session-state")).toHaveTextContent(
      "unavailable",
    );
  });
});
