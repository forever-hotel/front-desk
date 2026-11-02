import { io, type Socket } from "socket.io-client";

import { env } from "@/config/env";

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

  realtimeSocket = io(baseUrl || undefined, {
    path: "/realtime/socket.io",
    auth: (callback) => {
      void fetch("/api/auth/socket-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const body = await response.json();
          if (typeof body.ticket !== "string") throw new Error();
          callback({ ticket: body.ticket });
        })
        .catch(() => callback({ ticket: "" }));
    },
    autoConnect: false,

    reconnection: true,
    reconnectionAttempts: REALTIME_RECONNECT_POLICY.attempts,
    reconnectionDelay: REALTIME_RECONNECT_POLICY.delayMs,
    reconnectionDelayMax: REALTIME_RECONNECT_POLICY.maxDelayMs,
    timeout: REALTIME_RECONNECT_POLICY.timeoutMs,

    transports: ["websocket"],

    withCredentials: false,
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
