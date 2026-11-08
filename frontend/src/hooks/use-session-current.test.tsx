import { act, renderHook } from "@testing-library/react";
import { useSessionCurrent } from "./use-session-current";

describe("session expiry clock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-08T00:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());
  it.each([undefined, "invalid", "2000-01-01T00:00:00Z"])(
    "rejects unavailable or expired sessions %s",
    (expires) => {
      const { result } = renderHook(() => useSessionCurrent(expires));
      expect(result.current).toBe(false);
    },
  );
  it("expires a current session without another page render", () => {
    const { result } = renderHook(() =>
      useSessionCurrent("2026-11-08T00:00:01Z"),
    );
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });
  it("switches sessions without retaining the previous session timer", () => {
    const { result, rerender } = renderHook(
      ({ expires }) => useSessionCurrent(expires),
      { initialProps: { expires: "2026-11-08T00:00:01Z" } },
    );
    rerender({ expires: "2026-11-08T00:00:03Z" });
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(2000));
    expect(result.current).toBe(false);
  });
  it("reschedules long sessions beyond the maximum timer delay", () => {
    const maximumDelay = 2_147_483_647;
    const expiry = new Date(Date.now() + maximumDelay + 1000).toISOString();
    const { result } = renderHook(() => useSessionCurrent(expiry));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(maximumDelay));
    expect(result.current).toBe(true);
    expect(jest.getTimerCount()).toBe(1);
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
  it("cancels pending expiry timers on unmount", () => {
    const { unmount } = renderHook(() =>
      useSessionCurrent("2026-11-08T00:00:01Z"),
    );
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
