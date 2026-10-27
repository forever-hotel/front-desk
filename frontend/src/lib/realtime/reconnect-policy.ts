export const REALTIME_RECONNECT_POLICY = {
  // Retry transport outages indefinitely, with the existing bounded delay.
  attempts: Infinity,
  delayMs: 1000,
  maxDelayMs: 5000,
  timeoutMs: 5000,
} as const;
