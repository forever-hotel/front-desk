import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";

import { getRunningFolio } from "./folios.api";

const bookingReference = "11111111-1111-4111-8111-111111111111";

describe("folios.api", () => {
  it("Given a checked-in booking, when its folio is requested, then the backend charge breakdown is returned", async () => {
    let requestedReference: string | undefined;

    server.use(
      http.get("*/folios/:bookingReference", ({ params }) => {
        requestedReference = String(params.bookingReference);

        return HttpResponse.json({
          bookingReference,
          roomNumber: "101",
          checkInDate: "2026-10-07",
          checkOutDate: "2026-10-09",
          bookingStatus: "CHECKED_IN",
          currency: "LKR",
          categories: [
            {
              category: "ROOM_CHARGES",
              items: [
                {
                  reference: "room-charge-1",
                  description: "Room accommodation",
                  amount: 20000,
                  occurredAt: "2026-10-07T10:00:00.000Z",
                },
              ],
              subtotal: 20000,
            },
            {
              category: "FOOD_AND_BEVERAGE",
              items: [
                {
                  reference: "food-charge-1",
                  description: "Restaurant charges",
                  amount: 3500,
                  occurredAt: "2026-10-08T12:00:00.000Z",
                },
              ],
              subtotal: 3500,
            },
            {
              category: "SERVICES",
              items: [],
              subtotal: 0,
            },
          ],
          total: 23500,
        });
      }),
    );

    const result = await getRunningFolio(bookingReference);

    expect(requestedReference).toBe(bookingReference);

    expect(result.bookingReference).toBe(bookingReference);

    expect(result.bookingStatus).toBe("CHECKED_IN");

    expect(result.currency).toBe("LKR");

    expect(result.categories).toHaveLength(3);

    expect(result.categories[0]?.subtotal).toBe(20000);

    expect(result.categories[1]?.subtotal).toBe(3500);

    expect(result.total).toBe(23500);
  });

  it("Given a folio without additional charges, when requested, then zero subtotals are preserved", async () => {
    server.use(
      http.get("*/folios/:bookingReference", () => {
        return HttpResponse.json({
          bookingReference,
          roomNumber: "102",
          checkInDate: "2026-10-08",
          checkOutDate: "2026-10-09",
          bookingStatus: "CHECKED_IN",
          currency: "LKR",
          categories: [
            {
              category: "ROOM_CHARGES",
              items: [],
              subtotal: 0,
            },
            {
              category: "FOOD_AND_BEVERAGE",
              items: [],
              subtotal: 0,
            },
            {
              category: "SERVICES",
              items: [],
              subtotal: 0,
            },
          ],
          total: 0,
        });
      }),
    );

    const result = await getRunningFolio(bookingReference);

    expect(result.total).toBe(0);

    expect(result.categories.every((category) => category.subtotal === 0)).toBe(
      true,
    );

    expect(
      result.categories.every((category) => category.items.length === 0),
    ).toBe(true);
  });

  it("Given a booking without an accessible running folio, when requested, then the backend error is propagated", async () => {
    server.use(
      http.get("*/folios/:bookingReference", () => {
        return HttpResponse.json(
          {
            message: "Running folio is unavailable",
          },
          {
            status: 404,
          },
        );
      }),
    );

    await expect(getRunningFolio(bookingReference)).rejects.toMatchObject({
      status: 404,
      message: "Running folio is unavailable",
    });
  });
});
