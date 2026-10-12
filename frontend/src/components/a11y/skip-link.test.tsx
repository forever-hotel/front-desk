import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("provides keyboard users a link to the main landmark", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <>
        <SkipLink />
        <main id="fds-main-content" tabIndex={-1}>
          <h1>Front Desk</h1>
        </main>
      </>,
    );

    const link = screen.getByRole("link", { name: "Skip to main content" });

    expect(link).toHaveAttribute("href", "#fds-main-content");

    await user.tab();
    expect(link).toHaveFocus();

    expect(await axe(container)).toHaveNoViolations();
  });
});
