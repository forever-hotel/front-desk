import test from "node:test";
import assert from "node:assert/strict";
import { validateRelease, rollout } from "./release.mjs";
const sha = "a".repeat(40);
const release = {
  commit: sha,
  frontend:
    "ghcr.io/forever-hotel/front-desk/frontend@sha256:" + "b".repeat(64),
  backend: "ghcr.io/forever-hotel/front-desk/backend@sha256:" + "c".repeat(64),
};
test("only complete Front Desk digests from the triggering commit are accepted", () => {
  assert.deepEqual(Object.keys(validateRelease(release, sha)), [
    "fds-backend",
    "fds-frontend",
  ]);
  for (const invalid of [
    { ...release, commit: "d".repeat(40) },
    { ...release, frontend: release.frontend.slice(0, -1) },
    { ...release, backend: release.backend.replace("front-desk", "other") },
  ])
    assert.throws(() => validateRelease(invalid, sha));
});
function fixture(fail = "") {
  const calls = [];
  let health = 0;
  let replace = 0;
  const baseline = { old: true };
  return {
    calls,
    adapter: {
      snapshot: async () => baseline,
      check: async () => calls.push("check"),
      health: async () => {
        calls.push("health");
        health++;
        if (
          (fail === "post" && health === 2) ||
          (fail === "recovery" && health > 1)
        )
          throw Error("health");
      },
      pull: async () => {
        calls.push("pull");
        if (fail === "pull") throw Error("registry");
      },
      replace: async (images) => {
        calls.push(images === baseline ? "restore" : "deploy");
        replace++;
        if (fail === "partial" && replace === 1) throw Error("partial");
      },
      activate: async (images) =>
        calls.push(images === baseline ? "activate-old" : "activate-new"),
      record: async (r) => calls.push(r.status),
    },
  };
}
test("healthy release activates after verification", async () => {
  const f = fixture();
  await rollout(release, f.adapter);
  assert.deepEqual(f.calls, [
    "check",
    "health",
    "pull",
    "check",
    "deploy",
    "health",
    "activate-new",
    "released",
  ]);
});
test("registry failure does not replace containers", async () => {
  const f = fixture("pull");
  await assert.rejects(rollout(release, f.adapter));
  assert.ok(!f.calls.includes("deploy"));
  assert.ok(!f.calls.includes("restore"));
});
for (const fail of ["post", "partial"])
  test(
    fail + " failure restores previous images and still fails the release",
    async () => {
      const f = fixture(fail);
      await assert.rejects(rollout(release, f.adapter));
      assert.ok(f.calls.includes("restore"));
      assert.equal(f.calls.at(-1), "failed_rolled_back");
    },
  );
test("failed recovery is recorded honestly", async () => {
  const f = fixture("recovery");
  await assert.rejects(rollout(release, f.adapter));
  assert.equal(f.calls.at(-1), "failed_rollback_unverified");
});
