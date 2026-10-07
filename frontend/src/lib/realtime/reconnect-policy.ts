export const REALTIME_RECONNECT_POLICY = {
  attempts: 5,
  delayMs: 1000,
  maxDelayMs: 5000,
  timeoutMs: 5000,
} as const;
