import type { ReactElement } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render, type RenderOptions } from "@testing-library/react";

import type { RealtimeConnectionState } from "@/lib/realtime/realtime.type";
import { RealtimeContext } from "@/providers/realtime-provider";

type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  connectionState?: RealtimeConnectionState;
};

export function renderWithProviders(
  ui: ReactElement,
  {
    connectionState = "connected",
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeContext.Provider
        value={{
          connectionState,
        }}
      >
        {ui}
      </RealtimeContext.Provider>
    </QueryClientProvider>,
    renderOptions,
  );

  return {
    ...result,
    queryClient,
  };
}
