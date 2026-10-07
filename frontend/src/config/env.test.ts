import { ZodError } from "zod";

import { parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("Given valid public configuration, when parsed, then it returns the normalized environment", () => {
    const result = parsePublicEnv({
      NEXT_PUBLIC_APP_NAME: "Forever Hotel Front Desk",
      NEXT_PUBLIC_API_BASE_URL: "/fds",
      NEXT_PUBLIC_WS_URL: "/",
    });

    expect(result).toEqual({
      NEXT_PUBLIC_APP_NAME: "Forever Hotel Front Desk",
      NEXT_PUBLIC_API_BASE_URL: "/fds",
      NEXT_PUBLIC_WS_URL: "/",
    });
  });

  it("Given missing optional public configuration, when parsed, then safe defaults are used", () => {
    const result = parsePublicEnv({});

    expect(result).toEqual({
      NEXT_PUBLIC_APP_NAME: "Forever Hotel Front Desk",
      NEXT_PUBLIC_API_BASE_URL: "/fds",
      NEXT_PUBLIC_WS_URL: "/",
    });
  });

  it("Given an invalid API base URL, when parsed, then validation fails", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_API_BASE_URL: "not a valid url",
      }),
    ).toThrow(ZodError);
  });

  it("Given an absolute HTTPS gateway URL, when parsed, then it is accepted", () => {
    const result = parsePublicEnv({
      NEXT_PUBLIC_API_BASE_URL: "https://gateway.forever-hotel.example/fds",
    });

    expect(result.NEXT_PUBLIC_API_BASE_URL).toBe(
      "https://gateway.forever-hotel.example/fds",
    );
  });
});
