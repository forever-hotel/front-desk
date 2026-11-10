import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { server } from "../../../../tests/mocks/server";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";
import { WalkInPaymentConfirmation } from "./walk-in-payment-confirmation";

const bookingReference = "11111111-1111-4111-8111-111111111111";
const payment = {
  bookingReference,
  bookingStatus: "PENDING",
  paymentId: "22222222-2222-4222-8222-222222222222",
  paymentMethod: "CASH",
  paymentStatus: "PENDING",
  amount: 18000,
  currency: "LKR",
};

describe("WalkInPaymentConfirmation", () => {
  it("requires explicit cash receipt acknowledgement and sends no staff UUID", async () => {
    const user = userEvent.setup();
    const onConfirmed = jest.fn();
    let submitted: unknown = null;
    server.use(
      http.get("*/bookings/walk-in/:ref/pending-payment", () =>
        HttpResponse.json(payment),
      ),
      http.post(
        "*/bookings/walk-in/:ref/confirm-payment",
        async ({ request }) => {
          submitted = await request.json();
          return HttpResponse.json({
            ...payment,
            paymentStatus: "COMPLETED",
            bookingStatus: "CONFIRMED",
            paidAt: "2026-11-10T05:30:00.000Z",
            auditLogId: "33333333-3333-4333-8333-333333333333",
          });
        },
      ),
    );

    renderWithProviders(
      <WalkInPaymentConfirmation
        initialBookingReference={bookingReference}
        onConfirmed={onConfirmed}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Find Pending Payment" }),
    );
    expect(await screen.findByText("LKR 18,000")).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Confirm Payment Received",
    });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(submitted).toEqual({ confirmedReceived: true });
    expect(
      await screen.findByText("Payment recorded and booking confirmed."),
    ).toBeInTheDocument();
  });

  it("requires POS receipt before recording a card payment", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    server.use(
      http.get("*/bookings/walk-in/:ref/pending-payment", () =>
        HttpResponse.json({ ...payment, paymentMethod: "CARD_ON_SITE" }),
      ),
      http.post("*/bookings/walk-in/:ref/confirm-payment", () => {
        attempts++;
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(
      <WalkInPaymentConfirmation initialBookingReference={bookingReference} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Find Pending Payment" }),
    );
    await screen.findByText("Card on site");
    await user.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: "Confirm Payment Received" }),
    ).toBeDisabled();
    expect(attempts).toBe(0);
  });
});
