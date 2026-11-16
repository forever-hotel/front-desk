import { jest } from "@jest/globals";

jest.doMock("@/config/env", () => ({
  env: {
    NEXT_PUBLIC_APP_NAME: "Forever Hotel Front Desk",

    NEXT_PUBLIC_API_BASE_URL: "/fds/",

    NEXT_PUBLIC_WS_URL: "/",
  },
}));

let apiClient: typeof import("./api-client").apiClient;

let buildApiUrl: typeof import("./api-client").buildApiUrl;

let unauthorizedEvent: typeof import("./api-client").UNAUTHORIZED_EVENT;

beforeAll(async () => {
  const apiClientModule = await import("./api-client");

  apiClient = apiClientModule.apiClient;

  buildApiUrl = apiClientModule.buildApiUrl;

  unauthorizedEvent = apiClientModule.UNAUTHORIZED_EVENT;
});

function createJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,

    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("api-client branch coverage", () => {
  it("Given a base URL with a trailing slash, when API URLs are built, then duplicate slashes are removed and both path forms are supported", () => {
    expect(buildApiUrl("bookings/search")).toBe("/fds/bookings/search");

    expect(buildApiUrl("/bookings/search")).toBe("/fds/bookings/search");
  });

  it("Given a JSON request body without a content type, when a request is sent, then JSON content type is added and custom cache is preserved", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        ok: true,
      }),
    );

    const result = await apiClient<{
      ok: boolean;
    }>("/bookings", {
      method: "POST",

      body: JSON.stringify({
        guest: "Rashmi",
      }),

      cache: "reload",
    });

    expect(result).toEqual({
      ok: true,
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1];

    const headers = requestOptions?.headers as Headers;

    expect(headers.get("Accept")).toBe("application/json");

    expect(headers.get("Content-Type")).toBe("application/json; charset=utf-8");

    expect(requestOptions?.cache).toBe("reload");

    expect(requestOptions?.credentials).toBe("include");
  });

  it("Given a request without a body, when it is sent, then JSON content type is not added and no-store is used by default", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        ok: true,
      }),
    );

    await apiClient("/bookings");

    const requestOptions = fetchMock.mock.calls[0]?.[1];

    const headers = requestOptions?.headers as Headers;

    expect(headers.has("Content-Type")).toBe(false);

    expect(requestOptions?.cache).toBe("no-store");
  });

  it("Given a FormData body, when a request is sent, then the API client does not force a JSON content type", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        ok: true,
      }),
    );

    const formData = new FormData();

    formData.append("fileName", "guest.txt");

    await apiClient("/upload", {
      method: "POST",

      body: formData,
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1];

    const headers = requestOptions?.headers as Headers;

    expect(headers.has("Content-Type")).toBe(false);
  });

  it("Given a caller supplied content type, when a body is sent, then the existing header is preserved", async () => {
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        ok: true,
      }),
    );

    await apiClient("/custom", {
      method: "POST",

      body: "{}",

      headers: {
        "Content-Type": "application/custom",
      },
    });

    const requestOptions = fetchMock.mock.calls[0]?.[1];

    const headers = requestOptions?.headers as Headers;

    expect(headers.get("Content-Type")).toBe("application/custom");
  });

  it("Given an API error with multiple validation messages, when the request fails, then the messages are joined", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse(
        {
          message: ["Guest name is required", "Email is invalid"],

          code: "VALIDATION_ERROR",
        },
        400,
      ),
    );

    await expect(apiClient("/bookings")).rejects.toThrow(
      "Guest name is required, Email is invalid",
    );
  });

  it("Given an API error with a single message, when the request fails, then that message is preserved", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse(
        {
          message: "Booking not found",
        },
        404,
      ),
    );

    await expect(apiClient("/bookings/unknown")).rejects.toThrow(
      "Booking not found",
    );
  });

  it("Given an error response without a message, when the request fails, then the HTTP status fallback message is used", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse(
        {
          error: "SERVER_ERROR",
        },
        500,
      ),
    );

    await expect(apiClient("/bookings")).rejects.toThrow(
      "Request failed with status 500",
    );
  });

  it("Given an error response that is not valid JSON, when the request fails, then the HTTP status fallback message is used", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("not-json", {
        status: 500,

        headers: {
          "Content-Type": "text/plain",
        },
      }),
    );

    await expect(apiClient("/bookings")).rejects.toThrow(
      "Request failed with status 500",
    );
  });

  it("Given a 401 response in the browser, when the request fails, then the centralized unauthorized event is dispatched", async () => {
    const unauthorizedListener = jest.fn();

    window.addEventListener(unauthorizedEvent, unauthorizedListener);

    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse(
        {
          message: "Authentication required",

          error: "UNAUTHORIZED",
        },
        401,
      ),
    );

    try {
      await expect(apiClient("/bookings")).rejects.toThrow(
        "Authentication required",
      );

      expect(unauthorizedListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(unauthorizedEvent, unauthorizedListener);
    }
  });

  it("Given a successful 204 response, when the request completes, then undefined is returned without parsing JSON", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 204,
      }),
    );

    const result = await apiClient<undefined>("/bookings/123", {
      method: "DELETE",
    });

    expect(result).toBeUndefined();
  });
});
