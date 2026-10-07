import type { ReactNode } from "react";

import { renderHook, waitFor } from "@testing-library/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { jest } from "@jest/globals";

type GetRecentBookingsMock = (limit?: number) => Promise<never[]>;

const getRecentBookingsMock = jest.fn<GetRecentBookingsMock>();

jest.doMock("../api/reservations.api", () => ({
  getRecentBookings: getRecentBookingsMock,
}));

let useRecentBookings: typeof import("./use-recent-bookings").useRecentBookings;

beforeAll(async () => {
  const hookModule = await import("./use-recent-bookings");

  useRecentBookings = hookModule.useRecentBookings;
});

beforeEach(() => {
  getRecentBookingsMock.mockReset();

  getRecentBookingsMock.mockResolvedValue([]);
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useRecentBookings", () => {
  it("Given no limit, when the hook runs, then it requests the default five recent bookings", async () => {
    const { result } = renderHook(() => useRecentBookings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getRecentBookingsMock).toHaveBeenCalledWith(5);
  });

  it("Given an explicit limit, when the hook runs, then it forwards that limit to the reservations API", async () => {
    const { result } = renderHook(() => useRecentBookings(8), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getRecentBookingsMock).toHaveBeenCalledWith(8);
  });
});
