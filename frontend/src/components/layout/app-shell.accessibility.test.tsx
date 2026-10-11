import type { Ref } from "react";

import { jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

jest.doMock("./header", () => ({
  __esModule: true,
  default: ({
    onMenuToggle,
    menuButtonRef,
    expanded,
  }: {
    onMenuToggle: () => void;
    menuButtonRef?: Ref<HTMLButtonElement>;
    expanded?: boolean;
  }) => (
    <header>
      <button
        type="button"
        ref={menuButtonRef}
        onClick={onMenuToggle}
        aria-label="Toggle navigation"
        aria-expanded={expanded}
        aria-controls="fds-primary-navigation"
      >
        Menu
      </button>
    </header>
  ),
}));

jest.doMock("./sidebar", () => ({
  __esModule: true,
  default: ({
    isOpen,
    onNavigate,
  }: {
    isOpen: boolean;
    onNavigate: () => void;
  }) => (
    <nav id="fds-primary-navigation" aria-label="Front Desk navigation">
      <span data-testid="sidebar-state">{isOpen ? "open" : "closed"}</span>
      <button type="button" onClick={onNavigate}>
        Navigate
      </button>
    </nav>
  ),
}));

let AppShell: typeof import("./app-shell").default;

beforeAll(async () => {
  AppShell = (await import("./app-shell")).default;
});

describe("AppShell keyboard accessibility", () => {
  it("opens and closes navigation with Escape and restores focus to menu toggle", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Audit Log</h1>
      </AppShell>,
    );

    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("open");

    await user.keyboard("{Escape}");
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("closed");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("focuses the main landmark when navigation completes", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Bookings</h1>
      </AppShell>,
    );
    await user.click(screen.getByRole("button", { name: "Toggle navigation" }));
    await user.click(screen.getByRole("button", { name: "Navigate" }));

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "fds-main-content");
    expect(main).toHaveFocus();
  });

  it("exposes the skip link and identifiable main landmark without axe violations", async () => {
    const { container } = render(
      <AppShell>
        <h1>Front Desk</h1>
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#fds-main-content");
    expect(await axe(container)).toHaveNoViolations();
  });
});
