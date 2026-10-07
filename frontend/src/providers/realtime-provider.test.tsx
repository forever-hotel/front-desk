import { type ReactNode, useContext } from "react";

import { act, render, screen } from "@testing-library/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { jest } from "@jest/globals";

import type { RoomStatusBoardItem } from "@/features/rooms";

import { queryKeys } from "@/lib/api/query-keys";

import { REALTIME_EVENTS } from "@/lib/realtime/realtime-event-names";

import type {
  RoomStatusUpdatedEvent,
  TaskEscalatedEvent,
} from "@/lib/realtime/realtime.type";

type SocketHandler = (...args: unknown[]) => void;

const socketHandlers = new Map<string, Set<SocketHandler>>();

const managerHandlers = new Map<string, Set<SocketHandler>>();

function addHandler(
  registry: Map<string, Set<SocketHandler>>,
  event: string,
  handler: SocketHandler,
) {
  const handlers = registry.get(event) ?? new Set<SocketHandler>();

  handlers.add(handler);

  registry.set(event, handlers);
}

function removeHandler(
  registry: Map<string, Set<SocketHandler>>,
  event: string,
  handler: SocketHandler,
) {
  const handlers = registry.get(event);

  if (!handlers) {
    return;
  }

  handlers.delete(handler);

  if (handlers.size === 0) {
    registry.delete(event);
  }
}

function emitSocketEvent(event: string, ...args: unknown[]) {
  const handlers = socketHandlers.get(event);

  if (!handlers) {
    return;
  }

  for (const handler of handlers) {
    handler(...args);
  }
}

function emitManagerEvent(event: string, ...args: unknown[]) {
  const handlers = managerHandlers.get(event);

  if (!handlers) {
    return;
  }

  for (const handler of handlers) {
    handler(...args);
  }
}

const socketOnMock = jest.fn((event: string, handler: SocketHandler) => {
  addHandler(socketHandlers, event, handler);
});

const socketOffMock = jest.fn((event: string, handler: SocketHandler) => {
  removeHandler(socketHandlers, event, handler);
});

const managerOnMock = jest.fn((event: string, handler: SocketHandler) => {
  addHandler(managerHandlers, event, handler);
});

const managerOffMock = jest.fn((event: string, handler: SocketHandler) => {
  removeHandler(managerHandlers, event, handler);
});

const socketConnectMock = jest.fn();

const mockSocket = {
  on: socketOnMock,

  off: socketOffMock,

  connect: socketConnectMock,

  io: {
    on: managerOnMock,

    off: managerOffMock,
  },
};

const getRealtimeSocketMock = jest.fn(() => mockSocket);

const disconnectRealtimeSocketMock = jest.fn();

jest.doMock("@/lib/realtime/socket-client", () => ({
  getRealtimeSocket: getRealtimeSocketMock,

  disconnectRealtimeSocket: disconnectRealtimeSocketMock,
}));

let realtimeProviderModule: typeof import("./realtime-provider");

beforeAll(async () => {
  realtimeProviderModule = await import("./realtime-provider");
});

beforeEach(() => {
  socketHandlers.clear();

  managerHandlers.clear();

  socketOnMock.mockClear();

  socketOffMock.mockClear();

  managerOnMock.mockClear();

  managerOffMock.mockClear();

  socketConnectMock.mockClear();

  getRealtimeSocketMock.mockClear();

  disconnectRealtimeSocketMock.mockClear();
});

function createQueryClient() {
  return new QueryClient({
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
}

function ConnectionStateProbe() {
  const context = useContext(realtimeProviderModule.RealtimeContext);

  return (
    <span data-testid="connection-state">
      {context?.connectionState ?? "missing"}
    </span>
  );
}

function renderRealtimeProvider(
  children: ReactNode = <ConnectionStateProbe />,
) {
  const queryClient = createQueryClient();

  const RealtimeProvider = realtimeProviderModule.RealtimeProvider;

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>{children}</RealtimeProvider>
    </QueryClientProvider>,
  );

  return {
    ...result,

    queryClient,
  };
}

function createRoomStatusEvent(
  roomNumber: string,
  status: RoomStatusBoardItem["status"],
  occurredAt = "2026-10-07T10:00:00.000Z",
): RoomStatusUpdatedEvent {
  return {
    eventId: "room-status-event-1",

    eventType: REALTIME_EVENTS.roomStatusUpdated,

    contractVersion: 1,

    occurredAt,

    data: {
      roomNumber,

      status,

      source: "ROOM_STATUS",
    },
  };
}

function createTaskEscalatedEvent(
  taskId: string,
  eventId = `event-${taskId}`,
): TaskEscalatedEvent {
  return {
    eventId,

    eventType: REALTIME_EVENTS.taskEscalated,

    eventVersion: 1,

    occurredAt: "2026-10-07T11:00:00.000Z",

    source: "worker-management",

    data: {
      taskId,

      taskCategory: "ROOM_CLEANING",

      roomNumber: "201",

      priority: "HIGH",

      escalatedAt: "2026-10-07T11:00:00.000Z",
    },
  };
}

describe("RealtimeProvider", () => {
  it("Given the provider mounts, when realtime initializes, then socket listeners are registered and a connection is started", () => {
    renderRealtimeProvider();

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "connecting",
    );

    expect(getRealtimeSocketMock).toHaveBeenCalledTimes(1);

    expect(socketOnMock).toHaveBeenCalledWith("connect", expect.any(Function));

    expect(socketOnMock).toHaveBeenCalledWith(
      "disconnect",
      expect.any(Function),
    );

    expect(socketOnMock).toHaveBeenCalledWith(
      "connect_error",
      expect.any(Function),
    );

    expect(socketOnMock).toHaveBeenCalledWith(
      REALTIME_EVENTS.roomStatusUpdated,
      expect.any(Function),
    );

    expect(socketOnMock).toHaveBeenCalledWith(
      REALTIME_EVENTS.taskEscalated,
      expect.any(Function),
    );

    expect(managerOnMock).toHaveBeenCalledWith(
      "reconnect_attempt",
      expect.any(Function),
    );

    expect(managerOnMock).toHaveBeenCalledWith(
      "reconnect_failed",
      expect.any(Function),
    );

    expect(socketConnectMock).toHaveBeenCalledTimes(1);
  });

  it("Given realtime connects, when the connect event is received, then state becomes connected and authoritative queries are invalidated", async () => {
    const { queryClient } = renderRealtimeProvider();

    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      emitSocketEvent("connect");
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "connected",
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.rooms.status,
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.escalations.recent,
    });
  });

  it("Given realtime connection lifecycle events, when disconnect and reconnect events occur, then the provider exposes the correct fallback and connecting states", () => {
    renderRealtimeProvider();

    act(() => {
      emitSocketEvent("disconnect");
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "fallback",
    );

    act(() => {
      emitManagerEvent("reconnect_attempt");
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "connecting",
    );

    act(() => {
      emitManagerEvent("reconnect_failed");
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "fallback",
    );

    act(() => {
      emitManagerEvent("reconnect_attempt");
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "connecting",
    );

    act(() => {
      emitSocketEvent("connect_error");
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent(
      "fallback",
    );
  });

  it("Given cached rooms, when a room-status event arrives, then only the matching room is updated", () => {
    const { queryClient } = renderRealtimeProvider();

    const rooms: RoomStatusBoardItem[] = [
      {
        roomNumber: "101",

        roomTypeId: "room-type-1",

        roomTypeName: "Standard",

        floor: 1,

        status: "VACANT",

        lastClearedAt: "2026-10-07T08:00:00.000Z",

        updatedAt: "2026-10-07T08:00:00.000Z",
      },

      {
        roomNumber: "102",

        roomTypeId: "room-type-2",

        roomTypeName: "Deluxe",

        floor: 1,

        status: "OCCUPIED",

        lastClearedAt: "2026-10-07T08:00:00.000Z",

        updatedAt: "2026-10-07T08:00:00.000Z",
      },
    ];

    queryClient.setQueryData(queryKeys.rooms.status, rooms);

    const event = createRoomStatusEvent(
      "101",
      "UNDER_MAINTENANCE",
      "2026-10-07T12:00:00.000Z",
    );

    act(() => {
      emitSocketEvent(REALTIME_EVENTS.roomStatusUpdated, event);
    });

    const updatedRooms = queryClient.getQueryData<RoomStatusBoardItem[]>(
      queryKeys.rooms.status,
    );

    expect(updatedRooms).toEqual([
      {
        ...rooms[0],

        status: "UNDER_MAINTENANCE",

        updatedAt: "2026-10-07T12:00:00.000Z",
      },

      rooms[1],
    ]);
  });

  it("Given no cached rooms, when a room-status event arrives, then no invalid cache entry is created", () => {
    const { queryClient } = renderRealtimeProvider();

    const event = createRoomStatusEvent("101", "OCCUPIED");

    act(() => {
      emitSocketEvent(REALTIME_EVENTS.roomStatusUpdated, event);
    });

    expect(queryClient.getQueryData(queryKeys.rooms.status)).toBeUndefined();
  });

  it("Given no cached escalations, when a task escalation arrives, then it becomes the first cached escalation", () => {
    const { queryClient } = renderRealtimeProvider();

    const event = createTaskEscalatedEvent("task-1");

    act(() => {
      emitSocketEvent(REALTIME_EVENTS.taskEscalated, event);
    });

    expect(queryClient.getQueryData(queryKeys.escalations.recent)).toEqual([
      event,
    ]);
  });

  it("Given an existing task escalation, when an updated event for the same task arrives, then the old task is replaced without duplication", () => {
    const { queryClient } = renderRealtimeProvider();

    const oldMatchingEvent = createTaskEscalatedEvent("task-1", "old-event");

    const differentEvent = createTaskEscalatedEvent(
      "task-2",
      "different-event",
    );

    queryClient.setQueryData(queryKeys.escalations.recent, [
      oldMatchingEvent,
      differentEvent,
    ]);

    const newMatchingEvent = createTaskEscalatedEvent("task-1", "new-event");

    act(() => {
      emitSocketEvent(REALTIME_EVENTS.taskEscalated, newMatchingEvent);
    });

    const escalations = queryClient.getQueryData<TaskEscalatedEvent[]>(
      queryKeys.escalations.recent,
    );

    expect(escalations).toEqual([newMatchingEvent, differentEvent]);

    expect(escalations).toHaveLength(2);
  });

  it("Given one hundred cached escalations, when another event arrives, then the realtime cache remains capped at one hundred items", () => {
    const { queryClient } = renderRealtimeProvider();

    const existingEvents = Array.from(
      {
        length: 100,
      },
      (_, index) => createTaskEscalatedEvent(`task-${index}`, `event-${index}`),
    );

    queryClient.setQueryData(queryKeys.escalations.recent, existingEvents);

    const newestEvent = createTaskEscalatedEvent("task-new", "event-new");

    act(() => {
      emitSocketEvent(REALTIME_EVENTS.taskEscalated, newestEvent);
    });

    const escalations = queryClient.getQueryData<TaskEscalatedEvent[]>(
      queryKeys.escalations.recent,
    );

    expect(escalations).toHaveLength(100);

    expect(escalations?.[0]).toEqual(newestEvent);

    expect(escalations).not.toContain(existingEvents[99]);
  });

  it("Given the provider is mounted, when it unmounts, then realtime listeners are removed and the singleton socket is disconnected", () => {
    const { unmount } = renderRealtimeProvider();

    unmount();

    expect(socketOffMock).toHaveBeenCalledWith("connect", expect.any(Function));

    expect(socketOffMock).toHaveBeenCalledWith(
      "disconnect",
      expect.any(Function),
    );

    expect(socketOffMock).toHaveBeenCalledWith(
      "connect_error",
      expect.any(Function),
    );

    expect(socketOffMock).toHaveBeenCalledWith(
      REALTIME_EVENTS.roomStatusUpdated,
      expect.any(Function),
    );

    expect(socketOffMock).toHaveBeenCalledWith(
      REALTIME_EVENTS.taskEscalated,
      expect.any(Function),
    );

    expect(managerOffMock).toHaveBeenCalledWith(
      "reconnect_attempt",
      expect.any(Function),
    );

    expect(managerOffMock).toHaveBeenCalledWith(
      "reconnect_failed",
      expect.any(Function),
    );

    expect(disconnectRealtimeSocketMock).toHaveBeenCalledTimes(1);
  });
});
