import { jest } from "@jest/globals";

type MockSocket = {
  disconnect: jest.Mock;
  removeAllListeners: jest.Mock;
  io: {
    removeAllListeners: jest.Mock;
  };
};

type IoMock = (uri: string, options: Record<string, unknown>) => MockSocket;

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthFlag = process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH;

let disconnectSocket:
  typeof import("./socket-client").disconnectRealtimeSocket | undefined;

async function getHandshakePayload(
  wsUrl = "http://localhost:4200",
): Promise<Record<string, string> | undefined> {
  jest.resetModules();

  const ioMock = jest.fn<IoMock>(() => ({
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    io: {
      removeAllListeners: jest.fn(),
    },
  }));

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
  disconnectSocket = socketClient.disconnectRealtimeSocket;

  socketClient.getRealtimeSocket();

  const options = ioMock.mock.calls[0]?.[1];

  if (!options || typeof options.auth !== "function") {
    throw new Error("Socket.IO auth callback is missing");
  }

  const auth = options.auth as (
    callback: (payload: Record<string, string>) => void,
  ) => void;

  const callback = jest.fn<(payload: Record<string, string>) => void>();

  auth(callback);

  expect(callback).toHaveBeenCalledTimes(1);

  return callback.mock.calls[0]?.[0];
}

describe("Socket.IO development JWT authentication", () => {
  beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: "development" });
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = "true";

    window.sessionStorage.removeItem("fds:dev-test-jwt");
  });

  afterEach(() => {
    disconnectSocket?.();

    disconnectSocket = undefined;

    jest.dontMock("socket.io-client");
    jest.dontMock("@/config/env");
    jest.restoreAllMocks();

    window.sessionStorage.removeItem("fds:dev-test-jwt");

    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    }

    if (originalAuthFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = originalAuthFlag;
    }
  });

  it("attaches a JWT for an allowed local WebSocket", async () => {
    window.sessionStorage.setItem("fds:dev-test-jwt", "local-test-token");

    expect(await getHandshakePayload()).toEqual({
      token: "local-test-token",
    });
  });

  it("does not attach a JWT when storage has no token", async () => {
    expect(await getHandshakePayload()).toEqual({});
  });

  it("does not attach a JWT when the feature flag is disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = "false";

    window.sessionStorage.setItem("fds:dev-test-jwt", "local-test-token");

    expect(await getHandshakePayload()).toEqual({});
  });

  it("does not attach a JWT outside development mode", async () => {
    Object.assign(process.env, { NODE_ENV: "test" });

    window.sessionStorage.setItem("fds:dev-test-jwt", "local-test-token");

    expect(await getHandshakePayload()).toEqual({});
  });

  it("does not send the test JWT to an external WebSocket host", async () => {
    window.sessionStorage.setItem("fds:dev-test-jwt", "local-test-token");

    expect(await getHandshakePayload("https://example.com")).toEqual({});
  });

  it("handles an invalid WebSocket URL safely", async () => {
    window.sessionStorage.setItem("fds:dev-test-jwt", "local-test-token");

    expect(await getHandshakePayload("http://[invalid")).toEqual({});
  });

  it("handles unavailable session storage safely", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    expect(await getHandshakePayload()).toEqual({});
  });
});
