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
   * Do not read/write JWTs here and do not assume a login route
   * until the Auth Service frontend contract is integrated.
   */
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
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
