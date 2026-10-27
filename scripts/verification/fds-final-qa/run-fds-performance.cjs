'use strict';
/**
 * DDP-183 / Issue #84 — local, READ-ONLY FDS HTTP performance evidence.
 * Run from the front-desk repository root on Node 24+ with Docker Desktop.
 * All database resources are disposable and localhost-bound. No Neon use.
 * No mutation endpoints, no RabbitMQ, no WKMS, no real customer records.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const cp = require('node:child_process');
const { performance } = require('node:perf_hooks');

const ROOT = process.cwd();
const BACK = path.join(ROOT, 'backend');
const CONTAINER = 'fds-ddp183-performance-postgres';
const DB = 'front_desk_test';
const DB_PORT = 55436;
const HTTP_PORT = 4308;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;
const BRANCH = 'feature/84-fds-final-qa-evidence';
const PWD = crypto.randomBytes(24).toString('hex');
const JWT_SECRET = crypto.randomBytes(48).toString('hex');
const TESTER_ID = '66666666-6666-4666-8666-666666666666';
const LEVELS = [1, 5, 10];
const WARMUP = 12;
const REQUESTS = 120;
const TIMEOUT_MS = 7000;
const ROUTES = [
  { id: 'PERF-01', title: 'Database readiness', url: '/health/ready', auth: false, valid: x => x && x.database === 'up' },
  { id: 'PERF-02', title: 'Room status board', url: '/rooms/status', auth: true, valid: x => Array.isArray(x) },
  { id: 'PERF-03', title: 'Recent bookings', url: '/bookings/recent?limit=5', auth: true, valid: x => Array.isArray(x?.value) },
  { id: 'PERF-04', title: 'Booking search', url: '/bookings/search?query=CI', auth: true, valid: x => Array.isArray(x) },
  { id: 'PERF-05', title: 'Realtime contract', url: '/realtime/contract', auth: true, valid: x => x && x.namespace === '/realtime' },
];
const output = path.join(ROOT, 'evidence', 'fds-final-qa', 'performance');
const started = new Date();
let created = false;
let app = null;
let appLog = '';
let fatal = null;
const records = [];

function assert(check, message) { if (!check) throw Error(message); }
function safeError(e) {
  return String(e?.message || e).replaceAll(PWD, '[REDACTED]').replaceAll(JWT_SECRET, '[REDACTED]').slice(0, 500);
}
function run(command, args, options = {}) {
  const r = cp.spawnSync(command, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024, ...options,
  });
  if (r.error || r.status !== 0) {
    throw Error(`${command} command failed (${r.status}): ${safeError(r.error || r.stderr || r.stdout).slice(0, 300)}`);
  }
  return (r.stdout || '').trim();
}
const docker = (...args) => run('docker', args);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function portBusy(port) {
  return new Promise(resolve => {
    const sock = net.connect({host: '127.0.0.1', port});
    let settled = false;
    const finish = b => { if (settled) return; settled = true; sock.destroy(); resolve(b); };
    const timer = setTimeout(() => finish(true), 1500); // fail closed on uncertainty
    sock.once('connect', () => { clearTimeout(timer); finish(true); });
    sock.once('error', () => { clearTimeout(timer); finish(false); });
  });
}
function applySql(file) {
  assert(fs.existsSync(file), `Required SQL fixture missing: ${path.relative(ROOT, file)}`);
  const remote = `/tmp/${path.basename(file)}`;
  docker('cp', file, `${CONTAINER}:${remote}`);
  docker('exec', CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB, '-f', remote);
}
function sql(statement) {
  return docker('exec', CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB, '-Atc', statement);
}
function jwt() {
  const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const header = b64({typ: 'JWT', alg: 'HS256'});
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({sub: TESTER_ID, role: 'RECEPTIONIST', iss: 'forever-hotel-auth', iat: now, exp: now + 7200});
  const message = `${header}.${payload}`;
  return `${message}.${crypto.createHmac('sha256', JWT_SECRET).update(message).digest('base64url')}`;
}
async function request(route, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(BASE + route.url, {
      method: 'GET',
      headers: route.auth ? {Authorization: `Bearer ${token}`} : {},
      signal: controller.signal,
    });
    // Fully consume the response for consistent request latency measurements.
    const body = await res.arrayBuffer();
    const ms = performance.now() - start;
    return {ms, status: res.status, bytes: body.byteLength, error: res.status !== 200};
  } catch (e) {
    return {ms: performance.now() - start, status: 0, bytes: 0, error: true, reason: e.name === 'AbortError' ? 'timeout' : 'transport_error'};
  } finally {
    clearTimeout(timeout);
  }
}
function percentile(values, fraction) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)];
}
function round(x) { return x === null ? null : Number(x.toFixed(2)); }
async function benchmark(route, token, concurrency) {
  const responses = new Array(REQUESTS);
  let next = 0;
  const begin = performance.now();
  await Promise.all(Array.from({length: concurrency}, async () => {
    while (next < REQUESTS) {
      const index = next++;
      responses[index] = await request(route, token);
    }
  }));
  const elapsed = performance.now() - begin;
  const times = responses.map(r => r.ms);
  const errors = responses.filter(r => r.error);
  const result = {
    case_id: `${route.id}-C${concurrency}`,
    scenario: route.title,
    method: 'GET',
    endpoint: route.url,
    concurrency,
    warmup_requests: WARMUP,
    measured_requests: REQUESTS,
    successes: REQUESTS - errors.length,
    errors: errors.length,
    error_rate_pct: round(errors.length / REQUESTS * 100),
    mean_ms: round(times.reduce((a, b) => a + b, 0) / times.length),
    p50_ms: round(percentile(times, 0.5)),
    p95_ms: round(percentile(times, 0.95)),
    p99_ms: round(percentile(times, 0.99)),
    min_ms: round(Math.min(...times)),
    max_ms: round(Math.max(...times)),
    elapsed_s: round(elapsed / 1000),
    throughput_rps: round(REQUESTS / (elapsed / 1000)),
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    error_http_statuses: [...new Set(errors.map(r => r.status))].sort((a, b) => a - b),
  };
  records.push(result);
  console.log(`${result.result.padEnd(4)} ${result.case_id} requests=${REQUESTS} p50=${result.p50_ms}ms p95=${result.p95_ms}ms rate=${result.throughput_rps}/s errors=${result.errors}`);
}
async function prepare() {
  assert(process.version.match(/^v(2[4-9]|[3-9]\d)\./), 'Node.js version 24+ required');
  assert(fs.existsSync(path.join(BACK, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js')), 'Install FDS backend dependencies first: cd backend; npm ci');
  assert(run('git', ['branch', '--show-current']) === BRANCH, `Switch to ${BRANCH} first`);
  const current = run('git', ['rev-parse', 'HEAD']);
  console.log(`FDS commit ${current}`);
  assert(!await portBusy(DB_PORT), `Local DB port ${DB_PORT} is occupied; refusing to connect`);
  assert(!await portBusy(HTTP_PORT), `Local HTTP port ${HTTP_PORT} is occupied; refusing to connect`);
  docker('version', '--format', '{{.Server.Version}}');
  const exists = cp.spawnSync('docker', ['container', 'inspect', CONTAINER], {encoding: 'utf8'});
  assert(exists.status !== 0, `Container ${CONTAINER} already exists; inspect it before rerunning`);
  console.log('Creating NEW PostgreSQL 16 on 127.0.0.1:55436 (never Neon)...');
  docker('run', '-d', '--rm', '--name', CONTAINER,
    '-e', 'POSTGRES_USER=postgres', '-e', `POSTGRES_PASSWORD=${PWD}`,
    '-e', `POSTGRES_DB=${DB}`, '-p', `127.0.0.1:${DB_PORT}:5432`, 'postgres:16');
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    const r = cp.spawnSync('docker', ['exec', CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', DB], {encoding: 'utf8'});
    if (r.status === 0) { ready = true; break; }
    await pause(500);
  }
  assert(ready, 'Disposable PostgreSQL failed to start');
  assert(sql('select current_database()') === DB, 'Wrong PostgreSQL database');
  assert(docker('port', CONTAINER, '5432/tcp').includes(`127.0.0.1:${DB_PORT}`), 'PostgreSQL not bound exclusively to expected localhost port');
  applySql(path.join(BACK, 'test', 'database', 'shared-schema.sql'));
  const env = {
    ...process.env,
    NODE_ENV: 'test', PORT: String(HTTP_PORT),
    DB_HOST: '127.0.0.1', DB_PORT: String(DB_PORT),
    DB_USERNAME: 'postgres', DB_PASSWORD: PWD, DB_NAME: DB,
    DB_SSL: 'false', DB_SYNCHRONIZE: 'false', DB_LOGGING: 'false',
    FDS_AUTH_PROVIDER: 'legacy', JWT_ISSUER: 'forever-hotel-auth', JWT_SECRET,
    RABBITMQ_ENABLED: 'false', WKMS_INTEGRATION_ENABLED: 'false',
  };
  env.DATABASE_URL = `postgresql://postgres:${PWD}@127.0.0.1:${DB_PORT}/${DB}`;
  // Isolation: remove all external integration locations and credentials from child environment.
  for (const key of Object.keys(env)) {
    if (/^(CENTRAL_AUTH_|RABBITMQ_URL$|WKMS_BASE_URL$|FDS_WKMS_SERVICE_TOKEN$)/.test(key)) delete env[key];
  }
  console.log('Applying local migrations and CI seed data...');
  const npm = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/c', 'npm', 'run', 'migration:run'] : ['run', 'migration:run'];
  run(npm, args, {cwd: BACK, env});
  applySql(path.join(BACK, 'test', 'database', 'seed.sql'));
  assert(Number(sql('select count(*) from rooms')) >= 2, 'Fixture did not create rooms');
  assert(Number(sql('select count(*) from staff_users')) >= 1, 'Fixture did not create staff');
  console.log('Starting isolated FDS NestJS backend on 127.0.0.1:4308...');
  const nest = path.join(BACK, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  app = cp.spawn(process.execPath, [nest, 'start'], {cwd: BACK, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
  const capture = b => { appLog = (appLog + String(b)).slice(-12000); };
  app.stdout.on('data', capture);
  app.stderr.on('data', capture);
  let live = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (app.exitCode !== null) break;
    try {
      const r = await request(ROUTES[0]);
      if (r.status === 200) { live = true; break; }
    } catch (_) { /* startup retry */ }
    await pause(500);
  }
  if (!live) {
    const cleaned = appLog.slice(-1000)
      .replaceAll(PWD, '[REDACTED]')
      .replaceAll(JWT_SECRET, '[REDACTED]')
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]');

    console.error(`FDS process exit code: ${app.exitCode}; sanitized startup log tail: ${cleaned}`);
  }

  assert(live, 'FDS startup/readiness failed; see sanitized diagnostic above.');
  return {commit: current, token: jwt()};
}
async function execute(token) {
  // Preflight confirms authentication and each endpoint's expected JSON shape.
  const forbidden = await fetch(BASE + '/rooms/status');
  assert(forbidden.status === 401, `Access-control preflight failed: unauthenticated room board HTTP ${forbidden.status}`);
  for (const route of ROUTES) {
    const preflight = await fetch(BASE + route.url, {headers: route.auth ? {Authorization: `Bearer ${token}`} : {}});
    assert(preflight.status === 200, `${route.id} returned HTTP ${preflight.status} during preflight`);
    const value = await preflight.json();
    assert(route.valid(value), `${route.id} returned unexpected JSON shape`);
  }
  console.log('Authenticated endpoint preflight passed; all benchmark requests are GET only.');
  for (const route of ROUTES) {
    for (const c of LEVELS) {
      for (let i = 0; i < WARMUP; i++) {
        const res = await request(route, token);
        assert(res.status === 200, `${route.id} warmup failed: HTTP ${res.status}`);
      }
      await benchmark(route, token, c);
      await pause(180);
    }
  }
}
function save(commit) {
  fs.mkdirSync(output, {recursive: true});
  const data = {
    issue: '#84 / DDP-183',
    scope: 'Isolated local HTTP microbenchmark; not public staging or production',
    as_of: started.toISOString(),
    node_version: process.version,
    platform: process.platform,
    os_release: os.release(),
    cpu_count: os.cpus().length,
    total_memory_gb: round(os.totalmem() / 1024 ** 3),
    git_commit: commit,
    fixture: 'Fresh disposable PostgreSQL 16, CI shared-schema + migrations + deterministic seed',
    infrastructure: `127.0.0.1:${DB_PORT} PostgreSQL; 127.0.0.1:${HTTP_PORT} NestJS`,
    settings: {requests_per_case: REQUESTS, warmup_per_case: WARMUP, concurrency: LEVELS, timeout_ms: TIMEOUT_MS},
    limitations: [
      'Small deterministic test fixture; not representative of production database volume',
      'No TLS, reverse proxy, Gateway, shared Neon, RabbitMQ, WKMS, FOSS or public staging',
      'Read-only GET endpoints only; no check-in, checkout or write-operation load tests',
      'Measured on local operator hardware; numbers cannot be generalized to hosting infrastructure',
      'NFR pass/fail against a numeric SRS target requires verified, agreed SRS threshold',
    ],
    failure: fatal,
    results: records,
  };
  fs.writeFileSync(path.join(output, 'performance-results.json'), JSON.stringify(data, null, 2) + '\n');
  const fields = ['case_id','scenario','method','endpoint','concurrency','measured_requests','successes','errors','error_rate_pct','mean_ms','p50_ms','p95_ms','p99_ms','min_ms','max_ms','elapsed_s','throughput_rps','result'];
  const quote = v => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [fields, ...records.map(r => fields.map(k => r[k]))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(output, 'performance-execution-register.csv'), csv);
  const rows = records.map(r => `| ${r.case_id} | ${r.concurrency} | ${r.p50_ms} | ${r.p95_ms} | ${r.throughput_rps} | ${r.error_rate_pct}% | ${r.result} |`).join('\n');
  const md = [
    '# DDP-183 — FDS Local API Performance Verification', '',
    `**Date:** ${started.toISOString()}`,
    `**Git commit:** \`${commit || 'not determined'}\``,
    `**Environment:** disposable localhost PostgreSQL 16 (${DB}), NestJS, Node ${process.version}, ${os.platform()} ${os.release()}.`,
    `**Sample:** ${REQUESTS} measured calls + ${WARMUP} warmup calls for each of five GET endpoints at concurrency 1, 5 and 10.`,
    'Authentication: synthetic receptionist JWT signed with a test-only key; no central authentication service.',
    'RabbitMQ/WKMS disabled; actual production services, secrets and Neon were not used.', '',
    '## Measured results', '',
    '| Case | Concurrency | p50 ms | p95 ms | RPS | Error rate | Request result |',
    '|---|---:|---:|---:|---:|---:|---|', rows || '| Not run | — | — | — | — | — | NOT TESTED |', '',
    `**Requests with errors:** ${records.reduce((n, r) => n + r.errors, 0)} / ${records.reduce((n, r) => n + r.measured_requests, 0)}.`,
    `**Execution status:** ${fatal ? `INCOMPLETE — ${fatal}` : records.length === ROUTES.length * LEVELS.length && records.every(r => r.result === 'PASS') ? 'ALL MEASURED REQUESTS SUCCEEDED' : 'FAILED OR PARTIALLY EXECUTED'}.`,
    'This status is *not* an NFR/SLA PASS assertion; compare measurements against the approved SRS thresholds separately.', '',
    '## Limitations', ...data.limitations.map(x => `- ${x}`), '',
    'Raw values: `performance-results.json`; structured case register: `performance-execution-register.csv`.', '',
  ].join('\n');
  fs.writeFileSync(path.join(output, 'verification.md'), md);
  console.log(`Evidence: ${output}`);
}
function cleanup() {
  if (app && app.pid) {
    try {
      if (process.platform === 'win32') cp.spawnSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], {stdio:'ignore', timeout: 10000});
      else app.kill('SIGTERM');
    } catch (_) { /* best effort */ }
  }
  if (created) {
    try { docker('rm', '-f', CONTAINER); } catch (_) { console.warn(`Cleanup failed: inspect and remove ONLY ${CONTAINER}`); }
  }
}
(async () => {
  let commit = null;
  try {
    const setup = await prepare();
    commit = setup.commit;
    await execute(setup.token);
  } catch (error) {
    fatal = safeError(error);
    console.error(`FAILED: ${fatal}`);
  } finally {
    try {save(commit);} catch (error) {console.error(`Evidence write failed: ${safeError(error)}`);fatal ||= 'Evidence write failed';}
    cleanup();
  }
  process.exitCode = fatal || records.length !== ROUTES.length * LEVELS.length || records.some(r => r.errors > 0) ? 1 : 0;
  if (!process.exitCode) console.log('PASS: Local performance sampling complete. Review limitations before report sign-off.');
})();
