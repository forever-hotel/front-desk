'use strict';
/**
 * DDP-203 W04-B: actual FDS -> WKMS secure HTTP manual assignment.
 * ONLY disposable Plan 03 PostgreSQL; NO Neon, original .env writes, or RabbitMQ restart.
 * No auto-PASS: verifies actual HTTP status and authoritative DB/audit rows.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');

const ROOT = process.cwd();
const FDS = path.join(ROOT, 'backend');
const BRANCH = 'feature/91-fds-messaging-realtime-verification';
const WKMS_SHA = '3dd561cf3dab9115927f827efe36227684e950b6';
const DB_CONTAINER = 'fds-ddp203-postgres';
const DB_PORT = 55434;
const DB_NAME = 'front_desk_test';
const FDS_PORT = 4306;
const WKMS_PORT = 4406;
const STAFF = '66666666-6666-4666-8666-666666666666';
const WORKER = '67676767-6767-4676-8676-676767676767';
const ROOM = 'R1955';
const REPORT_BASE = path.join(ROOT, 'evidence', 'fds-messaging-realtime');
const RUN_AT = new Date().toISOString();
const ROLE = 'w04b' + crypto.randomBytes(5).toString('hex');
const PASSWORD = crypto.randomBytes(32).toString('hex');
const FDS_SECRET = crypto.randomBytes(40).toString('hex');
const SERVICE_TOKEN = crypto.randomBytes(40).toString('hex');
const TASK_ID = crypto.randomUUID();
const SERVICE_REQUEST_ID = crypto.randomUUID();
const OBS = [];
let WKMS_DIR, WKMS_BACKEND, FDS_PROCESS, WKMS_PROCESS, POOL;
let FDS_LOG = '', WKMS_LOG = '';
let roleCreated = false;
let taskInserted = false;
const delay = ms => new Promise(r => setTimeout(r, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function redact(input) {
  let s = String(input ?? '');
  for (const secret of [PASSWORD, SERVICE_TOKEN, FDS_SECRET, ROLE]) s = s.replaceAll(secret, '[REDACTED]');
  return s.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]');
}
function execute(cmd, args, options = {}) {
  const p = cp.spawnSync(cmd, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 180000, maxBuffer: 12 * 1024 * 1024, ...options,
  });
  if (p.error || p.status !== 0) throw Error(`${cmd} failed: ${redact(p.stderr || p.stdout || p.error?.message).slice(-1200)}`);
  return (p.stdout || '').trim();
}
const docker = (...args) => execute('docker', args);
const dbsql = sql => docker('exec', DB_CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB_NAME, '-Atc', sql);
async function busy(port) {
  return new Promise(resolve => {
    let settled = false;
    const socket = net.connect({host: '127.0.0.1', port});
    const done = value => {if(settled)return; settled=true; socket.destroy(); resolve(value);};
    const timeout = setTimeout(() => done(false), 1200);
    socket.once('connect', () => {clearTimeout(timeout);done(true);});
    socket.once('error', () => {clearTimeout(timeout);done(false);});
  });
}
async function until(fn, title, timeout = 85000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await fn()) return; } catch (_) { /* Poll transient startup errors. */ }
    await delay(650);
  }
  throw Error(`Timeout: ${title}. FDS log: ${redact(FDS_LOG).slice(-1000)} WKMS log: ${redact(WKMS_LOG).slice(-1000)}`);
}
async function request(base, method, pathPart, token, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch(`http://127.0.0.1:${base}${pathPart}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
        ...(token === undefined ? {} : {Authorization: `Bearer ${token}`}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    let json;
    try {json = await res.json();} catch {json = null;}
    return {status: res.status, json};
  } finally {clearTimeout(timer);}
}
function jwt(role = 'RECEPTIONIST') {
  const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const issued = Math.floor(Date.now() / 1000);
  const header = encode({alg: 'HS256', typ: 'JWT'});
  const payload = encode({sub: STAFF, role, iss: 'forever-hotel-auth', iat: issued, exp: issued + 3000});
  const signing = `${header}.${payload}`;
  return `${signing}.${crypto.createHmac('sha256', FDS_SECRET).update(signing).digest('base64url')}`;
}
function record(id, title, status, note = '') {
  const clean = redact(note).replace(/[\r\n]+/g, ' ').slice(0, 1000);
  OBS.push({id, title, status, note: clean});
  console.log(`${status.padEnd(7)} ${id} ${title}${clean ? ' — ' + clean : ''}`);
}
async function check(id, title, action) {
  try {record(id, title, 'PASS', await action());} catch (e) {record(id, title, 'FAIL', e.message);}
}
function block(id, title, why) {record(id, title, 'BLOCKED', why);}
function start(script, cwd, env, label, args = []) {
  const proc = cp.spawn(process.execPath, [script, ...args], {
    cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const update = chunk => {
    if (label === 'FDS') FDS_LOG = (FDS_LOG + String(chunk)).slice(-15000);
    else WKMS_LOG = (WKMS_LOG + String(chunk)).slice(-15000);
  };
  proc.stdout.on('data', update);
  proc.stderr.on('data', update);
  return proc;
}
function reports() {
  fs.mkdirSync(REPORT_BASE, {recursive: true});
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(REPORT_BASE, `w04b-live-assignment-${suffix}`);
  fs.mkdirSync(folder, {recursive: false});
  const escaped = cell => `"${String(cell).replaceAll('"', '""')}"`;
  const csv = [
    ['test_id', 'scenario', 'status', 'observed_result'],
    ...OBS.map(x => [x.id, x.title, x.status, x.note]),
  ].map(r => r.map(escaped).join(',')).join('\r\n') + '\r\n';
  const count = status => OBS.filter(x => x.status === status).length;
  const report = [
    '# DDP-203 — W04-B Real FDS-to-WKMS Manual Assignment', '',
    `Executed: ${RUN_AT}`,
    `Pinned WKMS commit: ${WKMS_SHA}`,
    'Environment: isolated Plan 03 Docker PostgreSQL front_desk_test on 127.0.0.1:55434; local FDS 4306, WKMS 4406.',
    'RabbitMQ disabled in this targeted REST integration run. No Neon connections or original .env changes.',
    'A synthetic FRONT_DESK task and resulting audit events are retained in the disposable database for inspection.',
    `Synthetic task ID: ${taskInserted ? TASK_ID : 'not created'}`,
    '', `**Results: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('BLOCKED')} BLOCKED.**`, '',
    ...OBS.map(x => `- **${x.status}** ${x.id}: ${x.title} — ${x.note}`),
    '', '## Scope and limitations',
    '- These checks exercise the actual HTTP servers, FDS adapter, WKMS controller, PostgreSQL task persistence and both audit records.',
    '- WKMS DDP-198 assignment is tested against one synthetic task/worker; it does not validate task creation or worker availability APIs.',
    '- WKMS internal service-task creation and available-worker discovery remain BLOCKED, not passed.',
    '- Repeated assignment may be rejected to FDS as HTTP 502 because the current generic adapter maps upstream HTTP 409 to Bad Gateway; track status mapping separately if this occurs.',
    '- The FDS and WKMS credentials, JWT and test database passwords are never included in reports.',
    '- This is a local disposable integration environment, not a production deployment or central-auth acceptance test.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(folder, 'execution-register.csv'), csv, 'utf8');
  fs.writeFileSync(path.join(folder, 'verification.md'), report, 'utf8');
  return folder;
}
async function setup() {
  assert(execute('git', ['branch', '--show-current']) === BRANCH, 'Incorrect FDS feature branch. Stop.');
  assert(fs.existsSync(path.join(FDS, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js')), 'FDS backend dependencies not installed');
  assert(fs.existsSync(path.join(FDS, 'node_modules', 'pg')), 'FDS node_modules/pg missing');
  for (const port of [FDS_PORT, WKMS_PORT]) assert(!(await busy(port)), `Port ${port} already occupied; refusing to connect to another server`);
  assert(docker('inspect', '-f', '{{.State.Running}}', DB_CONTAINER) === 'true', 'Plan 03 disposable PostgreSQL container is not running');
  const ports = docker('port', DB_CONTAINER, '5432/tcp');
  assert(ports.includes('127.0.0.1:55434'), 'Disposable database port mapping differs from Plan 03');
  assert(dbsql('SELECT current_database()') === DB_NAME, 'Unexpected database name; STOP');
  assert(dbsql("SELECT (to_regclass('public.wkms_tasks') IS NOT NULL AND to_regclass('public.audit_logs') IS NOT NULL)::text") === 'true', 'Phase B WKMS/audit fixture tables not present');
  const room = dbsql(`SELECT notes FROM rooms WHERE room_number='${ROOM}'`);
  assert(room === 'DDP-195 isolated testing fixture', 'Known isolated room fixture missing');
  const staff = dbsql(`SELECT role::text||':'||is_active::text FROM staff_users WHERE worker_id='${STAFF}'`);
  assert(staff === 'RECEPTIONIST:true', 'DDP195 receptionist fixture missing');
  const worker = dbsql(`SELECT role::text||':'||is_active::text FROM staff_users WHERE worker_id='${WORKER}'`);
  assert(worker === 'WORKER:true', 'CI worker fixture missing');
  const existingCount = Number(dbsql(`SELECT count(*) FROM wkms_tasks WHERE assigned_worker_id='${WORKER}' AND status IN ('ASSIGNED','IN_PROGRESS')`));
  assert(existingCount < 3, 'Worker already at active-task limit, use another isolated fixture rather than altering tasks');
  console.log('PASS: Verified disposable Docker database, employee fixtures, and available worker task capacity.');

  WKMS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fds-w04b-wkms-'));
  WKMS_BACKEND = path.join(WKMS_DIR, 'backend');
  console.log('Cloning reviewed WKMS code into a temporary directory...');
  execute('git', ['clone', '--no-checkout', '--single-branch', '--branch', 'develop', 'https://github.com/forever-hotel/worker-management.git', WKMS_DIR], {timeout: 240000});
  execute('git', ['checkout', '--detach', WKMS_SHA], {cwd: WKMS_DIR});
  assert(execute('git', ['rev-parse', 'HEAD'], {cwd: WKMS_DIR}) === WKMS_SHA, 'WKMS pinned SHA checkout mismatch. STOP.');
  for (const [file, term] of [
    ['src/tasks/front-desk-assignment.controller.ts', "@Post(':taskId/manual-assign')"],
    ['src/auth/guards/front-desk-service.guard.ts', "FDS_WKMS_SERVICE_TOKEN"],
  ]) assert(fs.readFileSync(path.join(WKMS_BACKEND, file), 'utf8').includes(term), `WKMS expected contract missing: ${file}`);
  assert(fs.existsSync(path.join(WKMS_BACKEND, 'package-lock.json')), 'Pinned WKMS lockfile missing');
  const pkg = JSON.parse(fs.readFileSync(path.join(WKMS_BACKEND, 'package.json'), 'utf8'));
  assert(pkg.scripts.build === 'nest build', 'Unexpected WKMS build command');
  console.log('Installing pinned WKMS packages with lifecycle scripts disabled...');
  const isWin = process.platform === 'win32';
  const npmArgs = isWin ? ['/d', '/c', 'npm'] : [];
  const npmCommand = isWin ? 'cmd.exe' : 'npm';
  execute(npmCommand, [...npmArgs, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: WKMS_BACKEND, timeout: 900000});
  console.log('Building pinned WKMS backend...');
  execute(npmCommand, [...npmArgs, 'run', 'build'], {cwd: WKMS_BACKEND, timeout: 420000});
  assert(fs.existsSync(path.join(WKMS_BACKEND, 'dist', 'main.js')), 'WKMS dist/main.js not found');

  // Create a new disposable local-only DB role; the previous random Phase B password is not needed.
  dbsql(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}'`);
  roleCreated = true;
  dbsql(`GRANT CONNECT ON DATABASE ${DB_NAME} TO ${ROLE}`);
  dbsql(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);
  dbsql(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE}`);
  dbsql(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ROLE}`);
  const pg = require(path.join(FDS, 'node_modules', 'pg'));
  POOL = new pg.Pool({host: '127.0.0.1', port: DB_PORT, database: DB_NAME, user: ROLE, password: PASSWORD, max: 3, ssl: false});
  await POOL.query('SELECT 1');

  const commonFds = {
    ...process.env, NODE_ENV: 'test', PORT: String(FDS_PORT),
    DB_HOST: '127.0.0.1', DB_PORT: String(DB_PORT), DB_NAME,
    DB_USERNAME: ROLE, DB_PASSWORD: PASSWORD, DB_SSL: 'false', DB_SYNCHRONIZE: 'false', DB_LOGGING: 'false',
    JWT_SECRET: FDS_SECRET, JWT_ISSUER: 'forever-hotel-auth', FDS_AUTH_PROVIDER: 'legacy',
    RABBITMQ_ENABLED: 'false', WKMS_INTEGRATION_ENABLED: 'true',
    WKMS_BASE_URL: `http://127.0.0.1:${WKMS_PORT}`, FDS_WKMS_SERVICE_TOKEN: SERVICE_TOKEN,
    FDS_ALLOWED_ORIGINS: 'http://127.0.0.1:3102',
  };
  delete commonFds.DATABASE_URL;
  const wkmsEnv = {
    ...process.env, NODE_ENV: 'test', PORT: String(WKMS_PORT),
    DATABASE_URL: `postgresql://${ROLE}:${PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}`,
    JWT_SECRET: FDS_SECRET,
    FDS_WKMS_SERVICE_TOKEN: SERVICE_TOKEN,
    RABBITMQ_ENABLED: 'false',
  };
  console.log('Starting actual FDS and WKMS NestJS servers with local-only test credentials...');
  WKMS_PROCESS = start(path.join(WKMS_BACKEND, 'dist', 'main.js'), WKMS_BACKEND, wkmsEnv, 'WKMS');
  const nestCli = path.join(FDS, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  FDS_PROCESS = start(nestCli, FDS, commonFds, 'FDS', ['start']);
  await until(async () => {
    if (WKMS_PROCESS.exitCode !== null) throw Error('WKMS process exited');
    const x = await request(WKMS_PORT, 'GET', '/health/ready');
    return x.status === 200;
  }, 'WKMS ready');
  await until(async () => {
    if (FDS_PROCESS.exitCode !== null) throw Error('FDS process exited');
    const x = await request(FDS_PORT, 'GET', '/health/ready');
    return x.status === 200 && x.json?.database === 'up';
  }, 'FDS ready');
  console.log('PASS: Both real backends ready; WKMS manual-assign route checked at reviewed Git SHA.');

  const inserted = await POOL.query(`
    INSERT INTO wkms_tasks (
      task_id, room_number, category, description, priority, status,
      service_request_id, source, submitted_at, created_at, updated_at
    ) VALUES ($1, $2, 'EXTRA_TOWELS', 'DDP-203 W04B synthetic assignment fixture',
      'NORMAL', 'UNASSIGNED', $3, 'FRONT_DESK', NOW(), NOW(), NOW())
    RETURNING task_id`, [TASK_ID, ROOM, SERVICE_REQUEST_ID]);
  assert(inserted.rows.length === 1, 'WKMS test task not inserted');
  taskInserted = true;
  console.log('PASS: One synthetic WKMS FRONT_DESK task seeded, no real guest/service-request data used.');
}
async function tests() {
  await check('W04B-01', 'WKMS manual assignment rejects missing or incorrect service credentials', async () => {
    const url = `/wkms/tasks/${TASK_ID}/manual-assign`;
    const a = await request(WKMS_PORT, 'POST', url, undefined, {workerId: WORKER});
    const b = await request(WKMS_PORT, 'POST', url, crypto.randomBytes(40).toString('hex'), {workerId: WORKER});
    assert(a.status === 401 && b.status === 401, `Expected 401/401, received ${a.status}/${b.status}`);
    return 'Both missing and invalid inter-service bearer credentials rejected with 401';
  });
  await check('W04B-02', 'FDS rejects unauthenticated receptionist assignment', async () => {
    const res = await request(FDS_PORT, 'POST', `/service-requests/tasks/${TASK_ID}/assign`, undefined, {workerId: WORKER});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    return 'Unauthenticated FDS assignment returned HTTP 401';
  });
  await check('W04B-03', 'FDS rejects non-receptionist manual assignment', async () => {
    const res = await request(FDS_PORT, 'POST', `/service-requests/tasks/${TASK_ID}/assign`, jwt('MANAGER'), {workerId: WORKER});
    assert(res.status === 403, `Expected 403, got ${res.status}`);
    return 'JWT MANAGER principal denied the FDS receptionist-only write operation (403)';
  });
  let assigned = false;
  await check('W04B-04', 'Actual FDS -> WKMS authenticated HTTP assignment returns normalized contract', async () => {
    const res = await request(FDS_PORT, 'POST', `/service-requests/tasks/${TASK_ID}/assign`, jwt(), {workerId: WORKER});
    assert([200,201].includes(res.status), `FDS returned HTTP ${res.status}: ${JSON.stringify(res.json).slice(0,250)}`);
    assert(res.json?.taskId === TASK_ID && res.json?.assignedWorkerId === WORKER && res.json?.status === 'ASSIGNED',
      `FDS contract mismatch: ${JSON.stringify(res.json).slice(0,350)}`);
    assigned = true;
    return `FDS HTTP ${res.status}; normalized taskId/assignedWorkerId/status=ASSIGNED from live WKMS DDP-198`;
  });
  if (assigned) {
    await check('W04B-05', 'WKMS task ownership and both WKMS/FDS audit entries persist', async () => {
      const task = (await POOL.query('SELECT status::text,assigned_worker_id::text FROM wkms_tasks WHERE task_id=$1', [TASK_ID])).rows[0];
      assert(task?.status === 'ASSIGNED' && task.assigned_worker_id === WORKER, 'WKMS persisted status/worker mismatch');
      const entries = (await POOL.query(`
        SELECT action, actor_type::text, staff_user_id::text
        FROM audit_logs WHERE entity_type='WKMS_TASK' AND entity_id=$1 AND action IN ('TASK_MANUALLY_ASSIGNED', 'MANUAL_TASK_ASSIGNMENT')`, [TASK_ID])).rows;
      const wkms = entries.filter(x => x.action === 'TASK_MANUALLY_ASSIGNED');
      const fds = entries.filter(x => x.action === 'MANUAL_TASK_ASSIGNMENT');
      assert(wkms.length === 1, `Expected exactly one WKMS audit, got ${wkms.length}`);
      assert(fds.length === 1 && fds[0].staff_user_id === STAFF, 'FDS receptionist audit missing or actor mismatch');
      return 'One WKMS task transition audit and one FDS receptionist assignment audit; DB status ASSIGNED';
    });
    await check('W04B-06', 'WKMS rejects repeated assignment without changing ownership or duplicating audits', async () => {
      const res = await request(FDS_PORT, 'POST', `/service-requests/tasks/${TASK_ID}/assign`, jwt(), {workerId: WORKER});
      assert(![200,201].includes(res.status), `Repeated assignment should fail; HTTP ${res.status}`);
      const row = (await POOL.query('SELECT status::text,assigned_worker_id::text FROM wkms_tasks WHERE task_id=$1', [TASK_ID])).rows[0];
      assert(row.status === 'ASSIGNED' && row.assigned_worker_id === WORKER, 'Duplicate attempt changed ownership');
      const count = (await POOL.query(`SELECT COUNT(*)::int AS n FROM audit_logs WHERE entity_type='WKMS_TASK' AND entity_id=$1 AND action IN ('TASK_MANUALLY_ASSIGNED','MANUAL_TASK_ASSIGNMENT')`, [TASK_ID])).rows[0].n;
      assert(count === 2, `Unexpected duplicate audit records: ${count}`);
      return `Repeated assignment rejected (FDS HTTP ${res.status}); ownership and original two audits unchanged`;
    });
  } else {
    block('W04B-05', 'WKMS task/audit persistence', 'Dependent W04B-04 authorized assignment did not succeed');
    block('W04B-06', 'Repeated assignment rejected', 'Dependent W04B-04 authorized assignment did not succeed');
  }
  block('W04B-07', 'FDS creates a new WKMS service-request task', 'WKMS has not published the expected authenticated service-task creation API');
  block('W04B-08', 'FDS retrieves WKMS available workers', 'WKMS has not published the expected authenticated worker discovery API');
}
async function stop(proc) {
  if (!proc) return;
  try {
    if (process.platform === 'win32') cp.spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {stdio: 'ignore', timeout: 18000});
    else proc.kill('SIGTERM');
  } catch (_) { /* retain main failure */ }
}
(async () => {
  let didSetup = false;
  try {await setup(); didSetup = true; await tests();}
  catch (e) {console.error('SETUP/EXECUTION FAILURE:', redact(e.stack || e).slice(-2400));record('SETUP','W04B disposable environment or execution','FAIL',redact(e.message));}
  finally {
    await stop(FDS_PROCESS);
    await stop(WKMS_PROCESS);
    if (POOL) try { await POOL.end(); } catch (_) {}
    // Remove temporary elevated access after the child processes and pool close.
    if (roleCreated) {
      try {dbsql(`DROP OWNED BY ${ROLE}; DROP ROLE ${ROLE}`);} catch (e) {console.warn('WARNING: Test-only database role cleanup failed:', redact(e.message).slice(0,300));}
    }
    if (WKMS_DIR && WKMS_DIR.startsWith(path.join(os.tmpdir(), 'fds-w04b-wkms-'))) {
      try {fs.rmSync(WKMS_DIR, {recursive: true, force: true});} catch (_) {}
    }
    let reportPath;
    try {reportPath = reports();console.log('Evidence:', reportPath);} catch (e) {console.error('Evidence creation failed:', redact(e.message));}
    const count = s => OBS.filter(x => x.status === s).length;
    console.log(`W04-B: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('BLOCKED')} BLOCKED`);
    console.log('Disposable Plan 03 PostgreSQL container retained. No Neon access or WKMS repository changes.');
    process.exitCode = didSetup && !OBS.some(x => x.status === 'FAIL') && Boolean(reportPath) ? 0 : 1;
  }
})();
