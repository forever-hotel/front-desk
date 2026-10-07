import { jest } from "@jest/globals";

type MockManager = {
  removeAllListeners: jest.Mock;
};

type MockSocket = {
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
  io: MockManager;
};

type IoMock = (uri: string, options: Record<string, unknown>) => MockSocket;

function createMockSocket(): MockSocket {
  return {
    disconnect: jest.fn(),

    removeAllListeners: jest.fn(),

    io: {
      removeAllListeners: jest.fn(),
    },
  };
}

const ioMock = jest.fn<IoMock>(() => createMockSocket());

let getRealtimeSocket: typeof import("./socket-client").getRealtimeSocket;

let disconnectRealtimeSocket: typeof import("./socket-client").disconnectRealtimeSocket;

beforeAll(async () => {
  /*
   * next/jest transforms dynamic import() into require().
   * Register the mocks before importing socket-client so
   * socket-client receives the mocked Socket.IO implementation.
   */
  jest.resetModules();

  jest.doMock("socket.io-client", () => ({
    io: ioMock,
  }));

  jest.doMock("@/config/env", () => ({
    env: {
      NEXT_PUBLIC_APP_NAME: "Forever Hotel Front Desk",

      NEXT_PUBLIC_API_BASE_URL: "/fds",

      NEXT_PUBLIC_WS_URL: "/",
    },
  }));

  const socketClientModule = await import("./socket-client");

  getRealtimeSocket = socketClientModule.getRealtimeSocket;

  disconnectRealtimeSocket = socketClientModule.disconnectRealtimeSocket;
});

afterAll(() => {
  disconnectRealtimeSocket();

  jest.dontMock("socket.io-client");

  jest.dontMock("@/config/env");
});

describe("socket-client", () => {
  beforeEach(() => {
    disconnectRealtimeSocket();

    ioMock.mockClear();
  });

  afterEach(() => {
    disconnectRealtimeSocket();
  });

  it("Given no active socket, when the realtime socket is requested, then one configured Socket.IO client is created", () => {
    const socket = getRealtimeSocket();

    expect(socket).toBeDefined();

    expect(ioMock).toHaveBeenCalledTimes(1);

    const [realtimeUrl, options] = ioMock.mock.calls[0];

    expect(realtimeUrl).toContain("/realtime");

    expect(options).toEqual(
      expect.objectContaining({
        autoConnect: false,

        withCredentials: true,

        reconnection: true,

        reconnectionAttempts: 5,

        transports: ["websocket", "polling"],
      }),
    );
  });

  it("Given an existing realtime socket, when it is requested again, then the same singleton is returned", () => {
    const firstSocket = getRealtimeSocket();

    const secondSocket = getRealtimeSocket();

    expect(secondSocket).toBe(firstSocket);

    expect(ioMock).toHaveBeenCalledTimes(1);
  });

  it("Given an active realtime socket, when it is disconnected, then listeners are removed and the socket is closed", () => {
    const socket = getRealtimeSocket() as unknown as MockSocket;

    disconnectRealtimeSocket();

    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);

    expect(socket.io.removeAllListeners).toHaveBeenCalledTimes(1);

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it("Given a disconnected singleton, when another realtime socket is requested, then a new client is created", () => {
    const firstSocket = getRealtimeSocket();

    disconnectRealtimeSocket();

    const secondSocket = getRealtimeSocket();

    expect(secondSocket).not.toBe(firstSocket);

    expect(ioMock).toHaveBeenCalledTimes(2);
  });

  it("Given no active realtime socket, when disconnect is requested, then it completes safely", () => {
    expect(() => {
      disconnectRealtimeSocket();

      disconnectRealtimeSocket();
    }).not.toThrow();
  });
});
