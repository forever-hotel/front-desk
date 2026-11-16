import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContext } from "react";
import { RealtimeProvider, RealtimeContext } from "./realtime-provider";
import { queryKeys } from "@/lib/api/query-keys";
const handlers = new Map<string, (...args: unknown[]) => void>();
const socket = {
  on: jest.fn((name, fn) => handlers.set(name, fn)),
  off: jest.fn(),
  connect: jest.fn(),
  io: { on: jest.fn(), off: jest.fn() },
};
jest.mock("@/lib/realtime/socket-client", () => ({
  getRealtimeSocket: () => socket,
  disconnectRealtimeSocket: jest.fn(),
}));
function Probe() {
  return <p>{useContext(RealtimeContext)?.connectionState}</p>;
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <RealtimeProvider>
        <Probe />
      </RealtimeProvider>
    </QueryClientProvider>,
  );
  return { invalidate, client, ...view };
}
afterEach(() => {
  handlers.clear();
  jest.restoreAllMocks();
});
it("refetches authoritative snapshots after room/task invalidations without using payload fields", () => {
  const { invalidate } = setup();
  act(() => handlers.get("room.status.updated")?.({ changed: true }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.rooms.status });
  act(() => handlers.get("task.changed")?.({ changed: true }));
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.escalations.recent,
  });
});
it("falls back when the broker is down and resynchronizes when it recovers", () => {
  const { invalidate } = setup();
  act(() => handlers.get("connect")?.());
  expect(screen.getByText("connected")).toBeInTheDocument();
  act(() => handlers.get("realtime.status")?.({ healthy: false }));
  expect(screen.getByText("fallback")).toBeInTheDocument();
  invalidate.mockClear();
  act(() => handlers.get("realtime.status")?.({ healthy: true }));
  expect(invalidate).toHaveBeenCalledTimes(2);
});
