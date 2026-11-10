import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  rename,
  mkdir,
  open,
  unlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const names = ["fds-backend", "fds-frontend"];
export function validateRelease(value, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha || "") || value?.commit !== sha)
    throw Error("Release commit mismatch");
  for (const component of ["backend", "frontend"]) {
    const prefix = "ghcr.io/forever-hotel/front-desk/" + component + "@sha256:";
    if (
      typeof value[component] !== "string" ||
      !value[component].startsWith(prefix) ||
      !/^[a-f0-9]{64}$/.test(value[component].slice(prefix.length))
    )
      throw Error("Invalid Front Desk image");
  }
  return Object.fromEntries(names.map((name) => [name, value[name.slice(4)]]));
}
export async function rollout(images, adapter) {
  const baseline = await adapter.snapshot();
  await adapter.check();
  await adapter.health();
  await adapter.pull(images);
  await adapter.check();
  try {
    await adapter.replace(images);
    await adapter.health();
    await adapter.activate(images);
    await adapter.record({ status: "released", images, baseline });
  } catch {
    try {
      await adapter.replace(baseline);
      await adapter.health();
      await adapter.activate(baseline);
      await adapter.record({ status: "failed_rolled_back", images, baseline });
    } catch {
      await adapter.record({
        status: "failed_rollback_unverified",
        images,
        baseline,
      });
    }
    throw Error("Front Desk rollout failed");
  }
}
const run = (file, args) =>
  execFileSync(file, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
  }).trim();
const docker = (...args) => run("sudo", ["-n", "docker", ...args]);
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
async function atomic(file, value) {
  const temporary = file + ".tmp";
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(temporary, file);
}
export async function main([manifestFile, expectedSha, hostFile]) {
  const images = validateRelease(await json(manifestFile), expectedSha);
  const host = await json(hostFile);
  const group = host.groups?.full;
  if (
    host.environment !== "staging" ||
    host.adoptionApproved !== true ||
    host.stateDirectory !== "/opt/forever-hotel/.infra-release" ||
    host.sampleLock !==
      "/opt/hotel-website-staging/.sample-release/release.lock" ||
    group?.directory !== "/opt/forever-hotel" ||
    group.project !== "forever-hotel-full" ||
    group.activeOverride !==
      "/opt/forever-hotel/.infra-release/active-images.json" ||
    !Array.isArray(group.files) ||
    !group.files.length ||
    !group.profiles?.includes("fds") ||
    !host.expectedConfigHashes ||
    Object.keys(host.expectedConfigHashes).length < 4
  )
    throw Error("Approved staging host required");
  const state = host.stateDirectory;
  await mkdir(state, { recursive: true, mode: 0o700 });
  const locks = [];
  try {
    for (const file of [resolve(state, "release.lock"), host.sampleLock]) {
      const handle = await open(file, "wx", 0o600);
      locks.push([file, handle]);
      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          commit: expectedSha,
          at: new Date().toISOString(),
        }),
      );
    }
    const override = resolve(state, "fds-attempt.json");
    const compose = (file, operation) =>
      docker(
        "compose",
        "--project-name",
        group.project,
        "--project-directory",
        group.directory,
        ...(group.envFile ? ["--env-file", group.envFile] : []),
        ...group.files.flatMap((path) => ["-f", path]),
        "-f",
        file,
        ...group.profiles.flatMap((profile) => ["--profile", profile]),
        ...operation,
      );
    const adapter = {
      async check() {
        for (const [path, hash] of Object.entries(host.expectedConfigHashes))
          if (
            createHash("sha256")
              .update(await readFile(path))
              .digest("hex") !== hash
          )
            throw Error("Host configuration drift");
      },
      async snapshot() {
        const baseline = {};
        for (const name of names) {
          const info = JSON.parse(
            docker(
              "inspect",
              "--format",
              "{{json .}}",
              group.project + "-" + name + "-1",
            ),
          );
          if (!info.State.Running || !/^sha256:[a-f0-9]{64}$/.test(info.Image))
            throw Error("Front Desk baseline unavailable");
          baseline[name] = info.Image;
        }
        return baseline;
      },
      async health() {
        for (let attempt = 0; attempt < 12; attempt++) {
          try {
            docker(
              "exec",
              host.gatewayContainer,
              "node",
              "-e",
              '(async()=>{for(const [url,statuses] of [["http://fds-backend:4001/health/ready",[200]],["http://fds-frontend:3001/",[200,302,303,307,308]],["http://websocket:8081/health/ready",[200]]]){const r=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(10000)});await r.body?.cancel();if(!statuses.includes(r.status))process.exit(1)}})().catch(()=>process.exit(1))',
            );
            const status = run("curl", [
              "--silent",
              "--show-error",
              "--max-time",
              "15",
              "--resolve",
              "forever-hotel-frontdesk.duckdns.org:443:127.0.0.1",
              "--output",
              "/dev/null",
              "--write-out",
              "%{http_code}",
              "https://forever-hotel-frontdesk.duckdns.org/",
            ]);
            if (![200, 302, 303, 307, 308].includes(Number(status)))
              throw Error("Public health failed");
            return;
          } catch {
            if (attempt === 11) throw Error("Front Desk health failed");
            await new Promise((done) => setTimeout(done, 5000));
          }
        }
      },
      async pull(next) {
        for (const image of Object.values(next)) docker("pull", image);
      },
      async replace(next) {
        await atomic(override, {
          services: Object.fromEntries(
            names.map((name) => [name, { image: next[name] }]),
          ),
        });
        compose(override, ["config", "--quiet"]);
        compose(override, [
          "up",
          "-d",
          "--no-deps",
          "--no-build",
          "--pull",
          "never",
          "--force-recreate",
          ...names,
        ]);
      },
      async activate(next) {
        let current;
        try {
          current = await json(group.activeOverride);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          current = { services: {} };
        }
        await atomic(group.activeOverride, {
          ...current,
          services: {
            ...current.services,
            ...Object.fromEntries(
              names.map((name) => [name, { image: next[name] }]),
            ),
          },
        });
      },
      record: (record) =>
        atomic(resolve(state, "fds-last-attempt.json"), {
          ...record,
          commit: expectedSha,
          at: new Date().toISOString(),
        }),
    };
    await rollout(images, adapter);
    console.log("Front Desk staging release passed.");
  } finally {
    for (const [file, handle] of locks.reverse()) {
      await handle.close();
      await unlink(file);
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch(() => {
    console.error(
      "Front Desk deployment failed; inspect the failed step and private fds-last-attempt.json.",
    );
    process.exitCode = 1;
  });
