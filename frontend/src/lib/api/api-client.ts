import { env } from "@/config/env";

import { ApiError, type ApiErrorPayload } from "./api-error";

export const UNAUTHORIZED_EVENT = "fds:unauthorized";

type ApiClientOptions = RequestInit;

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildApiUrl(path: string) {
  return `${normalizeBaseUrl(env.NEXT_PUBLIC_API_BASE_URL)}${normalizePath(
    path,
  )}`;
}

function normalizeErrorMessage(
  message: ApiErrorPayload["message"],
  fallback: string,
) {
  if (Array.isArray(message)) {
    return message.join(", ");
  }

  return message ?? fallback;
}

async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

function handleUnauthorized() {
  if (typeof window === "undefined") {
    return;
  }

  /*
   * Authentication integration is centralized elsewhere.
   *
   * The production authentication flow must be integrated
   * with the centralized Authentication Service.
   *
   * Do not assume a login route or store production JWTs here.
   */
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

/*
 * Temporary JWT support for local development testing.
 *
 * This allows developers to verify protected Front Desk
 * API endpoints before the centralized Authentication
 * Service frontend integration is completed.
 *
 * Security:
 * - Only enabled in development mode.
 * - Requires an explicit environment flag.
 * - Only used when the frontend runs on localhost.
 * - Never generates or signs JWTs.
 * - Never accesses the JWT signing secret.
 * - Does not overwrite an existing Authorization header.
 *
 * Remove this temporary mechanism when centralized
 * authentication integration is completed.
 */
function attachDevelopmentTestToken(headers: Headers): void {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH !== "true" ||
    typeof window === "undefined"
  ) {
    return;
  }

  if (
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return;
  }

  if (headers.has("Authorization")) {
    return;
  }

  try {
    const devToken = window.sessionStorage.getItem("fds:dev-test-jwt");

    if (devToken) {
      headers.set("Authorization", `Bearer ${devToken}`);
    }
  } catch {
    // Continue without development authentication if
    // browser session storage is unavailable.
  }
}

export async function apiClient<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  /*
   * Attach a temporary test JWT only when local development
   * authentication has been explicitly enabled.
   *
   * Existing Authorization headers take priority.
   */
  attachDevelopmentTestToken(headers);

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
    credentials: "include",
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const payload = await readErrorPayload(response);

    if (response.status === 401) {
      handleUnauthorized();
    }

    throw new ApiError(
      normalizeErrorMessage(
        payload.message,
        `Request failed with status ${response.status}`,
      ),
      response.status,
      {
        code: payload.code ?? payload.error,
        details: payload.details,
        requestId: payload.requestId,
      },
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
