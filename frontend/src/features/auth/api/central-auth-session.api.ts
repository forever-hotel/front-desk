import {
  centralAuthSessionSchema,
  type CentralAuthSession,
} from "../types/central-auth-session";

/**
 * Proposed same-origin BFF endpoint. It has NOT been implemented yet.
 * When the frontend auth gate is enabled before the BFF exists, it fails closed.
 */
export const CENTRAL_AUTH_SESSION_PATH = "/api/fds-auth/session";

export async function getCentralAuthSession(): Promise<CentralAuthSession | null> {
  const response = await fetch(CENTRAL_AUTH_SESSION_PATH, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Central authentication session is unavailable");
  }

  const payload: unknown = await response.json();
  const parsed = centralAuthSessionSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid Central authentication session contract");
  }

  if (Date.parse(parsed.data.expiresAt) <= Date.now()) {
    return null;
  }

  return parsed.data;
}
