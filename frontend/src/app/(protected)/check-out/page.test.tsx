import { render, screen } from "@testing-library/react";
import CheckOutPage from "./page";

let sessionState: unknown;
jest.mock("@/features/auth/providers/central-auth-session-provider", () => ({
  useCentralAuthSession: () => sessionState,
}));
jest.mock("@/features/check-outs", () => ({
  CheckOutScreen: ({ performedBy }: { performedBy?: string }) => (
    <div data-testid="actor">{performedBy ?? "blocked"}</div>
  ),
}));

describe("check-out session integration", () => {
  it.each(["ROOT", "RECEPTIONIST"])(
    "uses the authenticated %s identity",
    (role) => {
      sessionState = {
        status: "authenticated",
        session: {
          userId: "44444444-4444-4444-8444-444444444444",
          role,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      };
      render(<CheckOutPage />);
      expect(screen.getByTestId("actor")).toHaveTextContent(
        "44444444-4444-4444-8444-444444444444",
      );
    },
  );
  it.each([
    { status: "loading", session: null },
    { status: "unauthenticated", session: null },
    {
      status: "authenticated",
      session: {
        userId: "actor",
        role: "MANAGER",
        expiresAt: "2099-01-01T00:00:00Z",
      },
    },
    {
      status: "authenticated",
      session: {
        userId: "actor",
        role: "ROOT",
        expiresAt: "2000-01-01T00:00:00Z",
      },
    },
    {
      status: "authenticated",
      session: {
        userId: "actor",
        role: "ROOT",
        passwordChangeRequired: true,
        expiresAt: "2099-01-01T00:00:00Z",
      },
    },
  ])("blocks unavailable or unauthorized sessions %#", (state) => {
    sessionState = state;
    render(<CheckOutPage />);
    expect(screen.getByTestId("actor")).toHaveTextContent("blocked");
  });
});
