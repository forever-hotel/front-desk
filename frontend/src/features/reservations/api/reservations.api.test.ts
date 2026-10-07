import { jest } from "@jest/globals";

type ApiClientMock = (path: string) => Promise<unknown>;

const apiClientMock = jest.fn<ApiClientMock>();

jest.doMock("@/lib/api/api-client", () => ({
  apiClient: apiClientMock,
}));

let searchBookings: typeof import("./reservations.api").searchBookings;

let getRecentBookings: typeof import("./reservations.api").getRecentBookings;

beforeAll(async () => {
  const reservationsApi = await import("./reservations.api");

  searchBookings = reservationsApi.searchBookings;

  getRecentBookings = reservationsApi.getRecentBookings;
});

beforeEach(() => {
  apiClientMock.mockReset();
});

describe("reservations.api", () => {
  describe("searchBookings", () => {
    it("Given a blank query, when bookings are searched, then no API request is made", async () => {
      const result = await searchBookings("   ");

      expect(result).toEqual([]);

      expect(apiClientMock).not.toHaveBeenCalled();
    });

    it("Given a query with surrounding whitespace, when bookings are searched, then the normalized query is encoded and sent to the API", async () => {
      const expectedResult: unknown[] = [];

      apiClientMock.mockResolvedValueOnce(expectedResult);

      const result = await searchBookings("  Jane Doe+1  ");

      expect(apiClientMock).toHaveBeenCalledTimes(1);

      expect(apiClientMock).toHaveBeenCalledWith(
        "/bookings/search?query=Jane+Doe%2B1",
      );

      expect(result).toBe(expectedResult);
    });
  });

  describe("getRecentBookings", () => {
    it("Given no limit, when recent bookings are requested, then the default limit of five is used", async () => {
      apiClientMock.mockResolvedValueOnce({
        value: [],
        count: 0,
      });

      const result = await getRecentBookings();

      expect(apiClientMock).toHaveBeenCalledWith("/bookings/recent?limit=5");

      expect(result).toEqual([]);
    });

    it("Given a limit below the supported range, when recent bookings are requested, then the limit is clamped to one", async () => {
      apiClientMock.mockResolvedValueOnce({
        value: [],
        count: 0,
      });

      await getRecentBookings(0);

      expect(apiClientMock).toHaveBeenCalledWith("/bookings/recent?limit=1");
    });

    it("Given a limit above the supported range, when recent bookings are requested, then the limit is clamped to twenty", async () => {
      apiClientMock.mockResolvedValueOnce({
        value: [],
        count: 0,
      });

      await getRecentBookings(99);

      expect(apiClientMock).toHaveBeenCalledWith("/bookings/recent?limit=20");
    });

    it("Given a decimal limit inside the supported range, when recent bookings are requested, then the limit is truncated", async () => {
      apiClientMock.mockResolvedValueOnce({
        value: [],
        count: 0,
      });

      await getRecentBookings(7.9);

      expect(apiClientMock).toHaveBeenCalledWith("/bookings/recent?limit=7");
    });
  });
});
