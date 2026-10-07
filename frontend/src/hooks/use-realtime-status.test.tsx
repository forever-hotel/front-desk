import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";

import { RealtimeContext } from "@/providers/realtime-provider";

import { useRealtimeStatus } from "./use-realtime-status";

describe("useRealtimeStatus", () => {
  it("Given a realtime provider, when the hook is used, then the current realtime context is returned", () => {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <RealtimeContext.Provider
          value={{
            connectionState: "connected",
          }}
        >
          {children}
        </RealtimeContext.Provider>
      );
    }

    const { result } = renderHook(() => useRealtimeStatus(), {
      wrapper: Wrapper,
    });

    expect(result.current).toEqual({
      connectionState: "connected",
    });
  });

  it("Given no realtime provider, when the hook is used, then an error is thrown", () => {
    expect(() => {
      renderHook(() => useRealtimeStatus());
    }).toThrow();
  });
});
