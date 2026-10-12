import { getLocalDevelopmentReceptionistId } from "./development-actor";

const originalNodeEnv = process.env.NODE_ENV;
const originalAuthFlag = process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH;
const receptionistId = "22222222-2222-4222-8222-222222222222";

function testToken(claims: Record<string, unknown>) {
  return `e30.${window.btoa(JSON.stringify(claims))}.fake-signature`;
}

describe("development actor hint", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH: "true",
    });
    window.sessionStorage.removeItem("fds:dev-test-jwt");
  });

  afterEach(() => {
    window.sessionStorage.removeItem("fds:dev-test-jwt");
    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    }
    if (originalAuthFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = originalAuthFlag;
    }
  });

  it("returns a receptionist ID for a nonexpired local-development JWT hint", () => {
    window.sessionStorage.setItem(
      "fds:dev-test-jwt",
      testToken({
        role: "RECEPTIONIST",
        sub: receptionistId,
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    );
    expect(getLocalDevelopmentReceptionistId()).toBe(receptionistId);
  });

  it("never returns a manager identity for a receptionist-only write", () => {
    window.sessionStorage.setItem(
      "fds:dev-test-jwt",
      testToken({
        role: "MANAGER",
        sub: receptionistId,
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    );
    expect(getLocalDevelopmentReceptionistId()).toBeNull();
  });

  it("rejects expired, malformed and absent tokens", () => {
    window.sessionStorage.setItem(
      "fds:dev-test-jwt",
      testToken({ role: "RECEPTIONIST", sub: receptionistId, exp: 1 }),
    );
    expect(getLocalDevelopmentReceptionistId()).toBeNull();
    window.sessionStorage.setItem("fds:dev-test-jwt", "invalid-token");
    expect(getLocalDevelopmentReceptionistId()).toBeNull();
    window.sessionStorage.removeItem("fds:dev-test-jwt");
    expect(getLocalDevelopmentReceptionistId()).toBeNull();
  });

  it("is disabled when the development flag is off", () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH = "false";
    window.sessionStorage.setItem(
      "fds:dev-test-jwt",
      testToken({
        role: "RECEPTIONIST",
        sub: receptionistId,
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    );
    expect(getLocalDevelopmentReceptionistId()).toBeNull();
  });
});
