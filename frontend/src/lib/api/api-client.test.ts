import { http, HttpResponse } from "msw";

import { server } from "../../../tests/mocks/server";

import { apiClient, buildApiUrl, UNAUTHORIZED_EVENT } from "./api-client";

import { ApiError } from "./api-error";

describe("apiClient", () => {
  it("Given an API path, when building the URL, then it uses the configured gateway base", () => {
    expect(buildApiUrl("/rooms/status")).toBe("/fds/rooms/status");
  });

  it("Given a successful API response, when requested, then it returns the decoded JSON", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json([
          {
            roomNumber: "101",
            roomTypeId: "type-1",
            roomTypeName: "Deluxe",
            floor: 1,
            status: "VACANT",
            lastClearedAt: null,
            updatedAt: "2026-10-07T10:00:00.000Z",
          },
        ]);
      }),
    );

    const result = await apiClient<
      Array<{
        roomNumber: string;
      }>
    >("/rooms/status");

    expect(result).toHaveLength(1);
    expect(result[0]?.roomNumber).toBe("101");
  });

  it("Given a gateway error response, when requested, then it throws a normalized ApiError", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          {
            code: "FORBIDDEN",
            message: "You do not have permission for this request.",
            requestId: "req-403",
          },
          {
            status: 403,
          },
        );
      }),
    );

    await expect(apiClient("/rooms/status")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      code: "FORBIDDEN",
      requestId: "req-403",
    });
  });

  it("Given a validation error containing multiple messages, when requested, then it normalizes the messages", async () => {
    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          {
            message: ["roomNumber is required", "status is invalid"],
          },
          {
            status: 400,
          },
        );
      }),
    );

    await expect(apiClient("/rooms/status")).rejects.toMatchObject({
      name: "ApiError",
      message: "roomNumber is required, status is invalid",
      status: 400,
    });
  });

  it("Given an unauthenticated response, when requested, then it publishes the unauthorized event", async () => {
    const listener = jest.fn();

    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    server.use(
      http.get("*/rooms/status", () => {
        return HttpResponse.json(
          {
            code: "UNAUTHENTICATED",
            message: "Please sign in again.",
          },
          {
            status: 401,
          },
        );
      }),
    );

    await expect(apiClient("/rooms/status")).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });
});
