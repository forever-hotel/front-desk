import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";
import {
  CENTRAL_AUTH_SESSION_PATH,
  getCentralAuthSession,
} from "./central-auth-session.api";

const staff = {
  userId: "66666666-6666-4666-8666-666666666666",
  displayName: "Front Desk User",
  role: "RECEPTIONIST",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

describe("Central Auth session BFF contract", () => {
  it("reads only verified, token-free staff identity from same-origin BFF", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, ({ request }) => {
        expect(request.headers.get("Accept")).toBe("application/json");
        return HttpResponse.json(staff);
      }),
    );
    await expect(getCentralAuthSession()).resolves.toEqual(staff);
  });

  it("treats 401 as unauthenticated", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({}, { status: 401 }),
      ),
    );
    await expect(getCentralAuthSession()).resolves.toBeNull();
  });

  it("rejects unsupported staff roles", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({ ...staff, role: "WORKER" }),
      ),
    );
    await expect(getCentralAuthSession()).rejects.toThrow(
      "Invalid Central authentication session contract",
    );
  });

  it("rejects token-bearing session payloads", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({ ...staff, accessToken: "must-not-be-exposed" }),
      ),
    );
    await expect(getCentralAuthSession()).rejects.toThrow(
      "Invalid Central authentication session contract",
    );
  });

  it("treats an expired session as unauthenticated", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({ ...staff, expiresAt: "2000-01-01T00:00:00.000Z" }),
      ),
    );
    await expect(getCentralAuthSession()).resolves.toBeNull();
  });

  it("does not treat server errors as a valid session", async () => {
    server.use(
      http.get(`*${CENTRAL_AUTH_SESSION_PATH}`, () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    );
    await expect(getCentralAuthSession()).rejects.toThrow(
      "Central authentication session is unavailable",
    );
  });
});
