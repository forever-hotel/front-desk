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
