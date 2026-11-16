export const REALTIME_RECONNECT_POLICY = {
  // Retry a transport outage at most five times with bounded backoff.
  attempts: 5,
  delayMs: 1000,
  maxDelayMs: 5000,
  timeoutMs: 5000,
} as const;
