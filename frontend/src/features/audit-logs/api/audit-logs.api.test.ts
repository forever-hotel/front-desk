import { http, HttpResponse } from "msw";

import { server } from "../../../../tests/mocks/server";

import { getAuditLogById, getAuditLogs } from "./audit-logs.api";

const entry = {
  logId: "11111111-1111-4111-8111-111111111111",
  eventCategory: "FRONT_DESK_OPERATION",
  actorType: "STAFF",
  staffUserId: "22222222-2222-4222-8222-222222222222",
  action: "CHECK_IN",
  entityType: "BOOKING",
  entityId: "33333333-3333-4333-8333-333333333333",
  details: { roomNumber: "101" },
  createdAt: "2026-10-08T10:00:00.000Z",
};

describe("audit-logs.api", () => {
  it("sends backend-supported pagination and exact-match filters", async () => {
    const observed = { url: new URL("http://example.invalid") };

    server.use(
      http.get("*/audit-logs", ({ request }) => {
        observed.url = new URL(request.url);
        return HttpResponse.json([entry]);
      }),
    );

    await expect(
      getAuditLogs({
        limit: 25,
        offset: 50,
        eventCategory: "FRONT_DESK_OPERATION",
        action: " check_in ",
      }),
    ).resolves.toEqual([entry]);

    expect(observed.url.searchParams.get("limit")).toBe("25");
    expect(observed.url.searchParams.get("offset")).toBe("50");
    expect(observed.url.searchParams.get("eventCategory")).toBe(
      "FRONT_DESK_OPERATION",
    );
    expect(observed.url.searchParams.get("action")).toBe("CHECK_IN");
  });

  it("omits empty optional filters", async () => {
    let keys: string[] = [];
    server.use(
      http.get("*/audit-logs", ({ request }) => {
        keys = Array.from(new URL(request.url).searchParams.keys());
        return HttpResponse.json([]);
      }),
    );
    await getAuditLogs({ limit: 25, offset: 0 });
    expect(keys).toEqual(["limit", "offset"]);
  });

  it("retrieves a specific audit entry by ID", async () => {
    server.use(
      http.get("*/audit-logs/:logId", ({ params }) => {
        expect(params.logId).toBe(entry.logId);
        return HttpResponse.json(entry);
      }),
    );

    await expect(getAuditLogById(entry.logId)).resolves.toEqual(entry);
  });

  it("propagates authorization failures instead of treating them as empty results", async () => {
    server.use(
      http.get("*/audit-logs", () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(getAuditLogs({ limit: 25, offset: 0 })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("propagates a missing detail record", async () => {
    server.use(
      http.get("*/audit-logs/:logId", () =>
        HttpResponse.json(
          { message: "Audit log entry not found" },
          { status: 404 },
        ),
      ),
    );
    await expect(getAuditLogById(entry.logId)).rejects.toMatchObject({
      status: 404,
    });
  });
});
