import { http, HttpResponse } from "msw";

import { server } from "../../../tests/mocks/server";
import { apiClient } from "./api-client";

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthFlag = process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH;

describe("API client development JWT authentication", () => {
  let capturedAuthorization: string | null;

  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH: "true",
    });

    window.sessionStorage.removeItem("fds:dev-test-jwt");

    capturedAuthorization = null;

    server.use(
      http.get("*/rooms/status", ({ request }) => {
        capturedAuthorization = request.headers.get("Authorization");

        return HttpResponse.json({
          status: "success",
        });
      }),
    );
  });

  afterEach(() => {
    window.sessionStorage.removeItem("fds:dev-test-jwt");

    jest.restoreAllMocks();

    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.assign(process.env, {
        NODE_ENV: originalNodeEnv,
      });
    }

    if (originalAuthFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = originalAuthFlag;
    }
  });

  it("attaches a development JWT to API requests", async () => {
    window.sessionStorage.setItem("fds:dev-test-jwt", "test-manager-jwt");

    await apiClient("/rooms/status");

    expect(capturedAuthorization).toBe("Bearer test-manager-jwt");
  });

  it("does not attach Authorization when no token exists", async () => {
    await apiClient("/rooms/status");

    expect(capturedAuthorization).toBeNull();
  });

  it("does not attach a token when the feature flag is disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = "false";

    window.sessionStorage.setItem("fds:dev-test-jwt", "test-manager-jwt");

    await apiClient("/rooms/status");

    expect(capturedAuthorization).toBeNull();
  });

  it("does not attach a development token outside development mode", async () => {
    Object.assign(process.env, {
      NODE_ENV: "test",
    });

    window.sessionStorage.setItem("fds:dev-test-jwt", "test-manager-jwt");

    await apiClient("/rooms/status");

    expect(capturedAuthorization).toBeNull();
  });

  it("preserves an existing Authorization header", async () => {
    window.sessionStorage.setItem("fds:dev-test-jwt", "test-manager-jwt");

    await apiClient("/rooms/status", {
      headers: {
        Authorization: "Bearer existing-token",
      },
    });

    expect(capturedAuthorization).toBe("Bearer existing-token");
  });

  it("continues without a token when session storage is unavailable", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    await apiClient("/rooms/status");

    expect(capturedAuthorization).toBeNull();
  });
});
