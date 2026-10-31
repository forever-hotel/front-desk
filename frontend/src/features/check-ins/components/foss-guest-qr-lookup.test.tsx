import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";
import { FossGuestQrLookup } from "./foss-guest-qr-lookup";

const bookingReference = "11111111-1111-4111-8111-111111111111";
const secondBookingReference = "22222222-2222-4222-8222-222222222222";

describe("FossGuestQrLookup", () => {
  it("does not allow QR requests for a missing or invalid booking UUID", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FossGuestQrLookup />);

    const selectButton = screen.getByRole("button", {
      name: "Select Checked-In Booking",
    });
    const referenceField = screen.getByRole("textbox", {
      name: "Checked-in booking reference",
    });

    expect(selectButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Print FOSS QR" }),
    ).not.toBeInTheDocument();

    await user.type(referenceField, "BK-002");
    expect(selectButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Print FOSS QR" }),
    ).not.toBeInTheDocument();
  });

  it("shows the QR print action only after staff selects a valid v4 booking UUID", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FossGuestQrLookup />);

    const selectButton = screen.getByRole("button", {
      name: "Select Checked-In Booking",
    });
    const referenceField = screen.getByRole("textbox", {
      name: "Checked-in booking reference",
    });

    await user.type(referenceField, `  ${bookingReference.toUpperCase()}  `);
    expect(selectButton).toBeEnabled();
    await user.click(selectButton);
    expect(screen.getByRole("button", { name: "Print FOSS QR" })).toBeEnabled();
  });

  it("clears the selected booking when the receptionist edits the UUID", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FossGuestQrLookup />);

    const selectButton = screen.getByRole("button", {
      name: "Select Checked-In Booking",
    });
    const referenceField = screen.getByRole("textbox", {
      name: "Checked-in booking reference",
    });

    await user.type(referenceField, bookingReference);
    await user.click(selectButton);
    expect(
      screen.getByRole("button", { name: "Print FOSS QR" }),
    ).toBeInTheDocument();

    await user.clear(referenceField);
    expect(selectButton).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Print FOSS QR" }),
    ).not.toBeInTheDocument();

    await user.type(referenceField, secondBookingReference);
    expect(selectButton).toBeEnabled();
    await user.click(selectButton);
    expect(
      screen.getByRole("button", { name: "Print FOSS QR" }),
    ).toBeInTheDocument();
  });
});
