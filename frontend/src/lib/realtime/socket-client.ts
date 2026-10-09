import { io, type Socket } from "socket.io-client";

import { env } from "@/config/env";

import { REALTIME_NAMESPACE } from "./realtime-event-names";

import { REALTIME_RECONNECT_POLICY } from "./reconnect-policy";

let realtimeSocket: Socket | null = null;

function normalizeBaseUrl(value: string) {
  if (value === "/") {
    return "";
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/*
 * Temporary local-development JWT support.
 *
 * Production authentication will use the centralized
 * Authentication Service.
 *
 * Never store the JWT signing secret in the frontend.
 */
function getDevelopmentWebSocketToken(): string | null {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH !== "true" ||
    typeof window === "undefined"
  ) {
    return null;
  }

  const allowedHosts = ["localhost", "127.0.0.1"];

  if (!allowedHosts.includes(window.location.hostname)) {
    return null;
  }

  try {
    const wsUrl = new URL(env.NEXT_PUBLIC_WS_URL, window.location.origin);

    if (!allowedHosts.includes(wsUrl.hostname)) {
      return null;
    }

    return window.sessionStorage.getItem("fds:dev-test-jwt");
  } catch {
    return null;
  }
}

export function getRealtimeSocket(): Socket {
  if (realtimeSocket) {
    return realtimeSocket;
  }

  const baseUrl = normalizeBaseUrl(env.NEXT_PUBLIC_WS_URL);

  realtimeSocket = io(`${baseUrl}${REALTIME_NAMESPACE}`, {
    autoConnect: false,

    reconnection: true,
    reconnectionAttempts: REALTIME_RECONNECT_POLICY.attempts,
    reconnectionDelay: REALTIME_RECONNECT_POLICY.delayMs,
    reconnectionDelayMax: REALTIME_RECONNECT_POLICY.maxDelayMs,
    timeout: REALTIME_RECONNECT_POLICY.timeoutMs,

    transports: ["websocket", "polling"],

    withCredentials: true,

    /*
     * Socket.IO authentication payload.
     *
     * Uses the temporary development JWT when available.
     * The callback runs when Socket.IO connects.
     */
    auth: (callback) => {
      const token = getDevelopmentWebSocketToken();

      callback(token ? { token } : {});
    },
  });

  return realtimeSocket;
}

export function disconnectRealtimeSocket() {
  if (!realtimeSocket) {
    return;
  }

  realtimeSocket.removeAllListeners();
  realtimeSocket.io.removeAllListeners();
  realtimeSocket.disconnect();

  realtimeSocket = null;
}
