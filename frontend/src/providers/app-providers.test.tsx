import { render, screen } from "@testing-library/react";

import { AppProviders } from "./app-providers";

describe("AppProviders", () => {
  it("Given application content, when global providers render, then the content remains available", () => {
    render(
      <AppProviders>
        <p>Application child</p>
      </AppProviders>,
    );

    expect(screen.getByText("Application child")).toBeInTheDocument();
  });
});
