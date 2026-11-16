import { render, screen } from "@testing-library/react";

import { AntdProvider } from "./antd-provider";

describe("AntdProvider", () => {
  it("Given child content, when the provider renders, then the child remains available", () => {
    render(
      <AntdProvider>
        <p>Ant Design child</p>
      </AntdProvider>,
    );

    expect(screen.getByText("Ant Design child")).toBeInTheDocument();
  });
});
