import { io } from "socket.io-client";
import { getRealtimeSocket, disconnectRealtimeSocket } from "./socket-client";
jest.mock("socket.io-client", () => ({
  io: jest.fn(() => ({
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    io: { removeAllListeners: jest.fn() },
  })),
}));
describe("Ticket-authenticated FDS sockets", () => {
  afterEach(() => {
    disconnectRealtimeSocket();
    jest.clearAllMocks();
  });
  it("uses HttpOnly cookies and never reads a development JWT into the handshake", () => {
    sessionStorage.setItem("fds:dev-test-jwt", "retired-token");
    getRealtimeSocket();
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        withCredentials: false,
        reconnectionAttempts: 5,
      }),
    );
    expect(jest.mocked(io).mock.calls[0][1]?.auth).toEqual(
      expect.any(Function),
    );
    expect(jest.mocked(io).mock.calls[0][1]?.path).toBe("/realtime/socket.io");
    sessionStorage.removeItem("fds:dev-test-jwt");
  });
});
