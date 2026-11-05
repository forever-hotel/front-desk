import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "./login-form";
const replace = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
describe("email staff sign-in", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  it("validates an email before submitting and retains the wire contract", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ passwordChangeRequired: true }),
      } as Response);
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "reception@example.com");
    await user.type(screen.getByLabelText("Password"), "private-password");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/change-password"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        body: JSON.stringify({
          username: "reception@example.com",
          password: "private-password",
        }),
      }),
    );
  });
});
