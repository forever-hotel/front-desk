import { http, HttpResponse } from "msw";

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import { server } from "../../../../tests/mocks/server";
import { renderWithProviders } from "../../../../tests/utils/render-with-providers";

import { CheckInDocumentPrintActions } from "./check-in-document-print-actions";

const bookingReference = "11111111-1111-4111-8111-111111111111";

function mockAcceptedPrint() {
  let receivedType: string | undefined;
  let receivedReference: string | undefined;

  server.use(
    http.post(
      "*/check-in/:bookingReference/print",
      async ({ request, params }) => {
        const payload = (await request.json()) as { documentType: string };
        receivedType = payload.documentType;
        receivedReference = String(params.bookingReference);

        return HttpResponse.json({
          status: "accepted",
          documentType: payload.documentType,
          bookingReference,
          roomNumber: "T102",
          printJobReference: `mock-print-${payload.documentType.toLowerCase()}`,
        });
      },
    ),
  );

  return {
    getLastRequest: () => ({ receivedType, receivedReference }),
  };
}

describe("CheckInDocumentPrintActions", () => {
  it("disables both actions without a selected checked-in booking", () => {
    renderWithProviders(<CheckInDocumentPrintActions />);

    expect(
      screen.getByRole("button", { name: "Print Registration Card" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Request Payment Receipt" }),
    ).toBeDisabled();
  });

  it("requests a registration card and confirms only job acceptance", async () => {
    const { getLastRequest } = mockAcceptedPrint();
    const user = userEvent.setup();
    renderWithProviders(
      <CheckInDocumentPrintActions bookingReference={bookingReference} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Print Registration Card" }),
    );

    expect(
      await screen.findByText("Registration-card print request accepted."),
    ).toBeInTheDocument();
    expect(getLastRequest()).toEqual({
      receivedType: "REGISTRATION_CARD",
      receivedReference: bookingReference,
    });
    expect(
      screen.getByText(/Physical printing has not been confirmed/),
    ).toBeInTheDocument();
  });

  it("requests a payment receipt through the existing checked-in print endpoint", async () => {
    const { getLastRequest } = mockAcceptedPrint();
    const user = userEvent.setup();
    renderWithProviders(
      <CheckInDocumentPrintActions bookingReference={bookingReference} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Request Payment Receipt" }),
    );

    expect(
      await screen.findByText("Payment-receipt print request accepted."),
    ).toBeInTheDocument();
    expect(getLastRequest()).toEqual({
      receivedType: "PAYMENT_RECEIPT",
      receivedReference: bookingReference,
    });
  });

  it("reports WKMS-independent printer service errors and does not show false success", async () => {
    server.use(
      http.post("*/check-in/:bookingReference/print", () =>
        HttpResponse.json(
          { message: "Print service unavailable" },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <CheckInDocumentPrintActions bookingReference={bookingReference} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Request Payment Receipt" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Payment-receipt print request failed.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Print service unavailable",
    );
    expect(
      screen.queryByText(/print request accepted/),
    ).not.toBeInTheDocument();
  });

  it("does not misrepresent a forbidden response as a completed print", async () => {
    server.use(
      http.post("*/check-in/:bookingReference/print", () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <CheckInDocumentPrintActions bookingReference={bookingReference} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Print Registration Card" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden");
  });

  it("has no detectable axe accessibility violations", async () => {
    const { container } = renderWithProviders(
      <CheckInDocumentPrintActions bookingReference={bookingReference} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
