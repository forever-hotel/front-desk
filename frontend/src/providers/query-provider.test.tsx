import { render, screen } from "@testing-library/react";

import { QueryProvider } from "./query-provider";

describe("QueryProvider", () => {
  it("Given child content, when the provider renders, then the child remains available", () => {
    render(
      <QueryProvider>
        <p>Provider child</p>
      </QueryProvider>,
    );

    expect(screen.getByText("Provider child")).toBeInTheDocument();
  });
});
