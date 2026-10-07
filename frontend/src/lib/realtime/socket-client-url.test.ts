import { jest } from "@jest/globals";

type MockSocket = {
  removeAllListeners: jest.Mock;

  disconnect: jest.Mock;

  io: {
    removeAllListeners: jest.Mock;
  };
};

type IoMock = (uri: string, options: Record<string, unknown>) => MockSocket;

function createMockSocket(): MockSocket {
  return {
    removeAllListeners: jest.fn(),

    disconnect: jest.fn(),

    io: {
      removeAllListeners: jest.fn(),
    },
  };
}

async function loadSocketClient(wsUrl: string) {
  jest.resetModules();

  const mockSocket = createMockSocket();

  const ioMock = jest.fn<IoMock>(() => mockSocket);

  jest.doMock("socket.io-client", () => ({
    io: ioMock,
  }));

  jest.doMock("@/config/env", () => ({
    env: {
      NEXT_PUBLIC_APP_NAME: "Forever Hotel Front Desk",

      NEXT_PUBLIC_API_BASE_URL: "/fds",

      NEXT_PUBLIC_WS_URL: wsUrl,
    },
  }));

  const socketClient = await import("./socket-client");

  return {
    socketClient,

    ioMock,

    mockSocket,
  };
}

afterEach(() => {
  jest.dontMock("socket.io-client");

  jest.dontMock("@/config/env");
});

describe("socket-client URL normalization", () => {
  it("Given a WebSocket base URL with a trailing slash, when the socket is created, then the trailing slash is removed before adding the realtime namespace", async () => {
    const { socketClient, ioMock } = await loadSocketClient(
      "http://localhost:3001/",
    );

    socketClient.getRealtimeSocket();

    expect(ioMock).toHaveBeenCalledWith(
      "http://localhost:3001/realtime",
      expect.any(Object),
    );

    socketClient.disconnectRealtimeSocket();
  });

  it("Given a WebSocket base URL without a trailing slash, when the socket is created, then the URL is preserved before adding the realtime namespace", async () => {
    const { socketClient, ioMock } = await loadSocketClient(
      "http://localhost:3001",
    );

    socketClient.getRealtimeSocket();

    expect(ioMock).toHaveBeenCalledWith(
      "http://localhost:3001/realtime",
      expect.any(Object),
    );

    socketClient.disconnectRealtimeSocket();
  });
});
