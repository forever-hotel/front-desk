import { ApiError } from "./api-error";

describe("ApiError", () => {
  it("Given API error metadata, when created, then it preserves the response context", () => {
    const error = new ApiError("Request failed", 403, {
      code: "FORBIDDEN",
      requestId: "request-123",
      details: {
        resource: "rooms",
      },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("Request failed");
    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.requestId).toBe("request-123");
    expect(error.details).toEqual({
      resource: "rooms",
    });
  });
});
