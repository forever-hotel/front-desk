import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";
import { CENTRAL_AUTH_SESSION_PATH } from "../api/central-auth-session.api";
import { CentralAuthSessionProvider } from "../providers/central-auth-session-provider";
import { CentralAuthGate } from "./central-auth-gate";

const router = {
  bfcacheId: "staff-auth-test",
  back: jest.fn(),
  forward: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  hmrRefresh: jest.fn(),
  prefetch: jest.fn(),
};
function renderGate() {
  return render(
    <AppRouterContext.Provider value={router}>
      <CentralAuthSessionProvider>
        <CentralAuthGate>
          <p>Protected dashboard content</p>
        </CentralAuthGate>
      </CentralAuthSessionProvider>
    </AppRouterContext.Provider>,
  );
}

describe("CentralAuthGate", () => {
  it("renders children after receiving verified staff identity", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({
          userId: "66666666-6666-4666-8666-666666666666",
          displayName: "Reception Test",
          role: "RECEPTIONIST",
          expiresAt: "2099-01-01T00:00:00.000Z",
        }),
      ),
    );
    renderGate();
    expect(
      await screen.findByText("Protected dashboard content"),
    ).toBeInTheDocument();
  });

  it("never renders protected content for an unauthenticated session", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({}, { status: 401 }),
      ),
    );
    renderGate();
    expect(
      await screen.findByRole("heading", { name: "Sign-in required" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Protected dashboard content"),
    ).not.toBeInTheDocument();
  });

  it("fails closed when the BFF has not yet been implemented", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );
    renderGate();
    expect(
      await screen.findByRole("heading", { name: "Session unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Protected dashboard content"),
    ).not.toBeInTheDocument();
  });
});
