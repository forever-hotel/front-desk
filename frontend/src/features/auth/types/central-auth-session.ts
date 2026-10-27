import { z } from "zod";

/**
 * Proposed, token-free response from the future same-origin FDS BFF.
 * Do not add an access token, refresh token, or signing secret here.
 */
export const centralAuthSessionSchema = z
  .object({
    userId: z.uuid(),
    displayName: z.string().trim().min(1).max(120),
    role: z.enum(["RECEPTIONIST", "MANAGER"]),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type CentralAuthSession = z.infer<typeof centralAuthSessionSchema>;
