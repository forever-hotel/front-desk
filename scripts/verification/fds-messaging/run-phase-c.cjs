'use strict';
/**
 * DDP-203 Phase C — controlled local broker interruption and recovery.
 * Intended ONLY for the two named disposable Plan 03 Docker containers.
 * Does not reset any containers, apply DB migrations, or alter shared resources.
 * Requires --allow-isolated-restart as explicit permission to restart the broker.
 * Captures real observed PASS/FAIL/BLOCKED results; never substitutes mocks.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const net = require('node:net');
const crypto = require('node:crypto');

const ROOT = process.cwd();
const BACK = path.join(ROOT, 'backend');
const EXPECTED_BRANCH = 'feature/91-fds-messaging-realtime-verification';
const DB_CONTAINER = 'fds-ddp203-postgres';
const RABBIT_CONTAINER = 'fds-ddp203-rabbitmq';
const DB_PORT = 55434;
const AMQP_PORT = 5673;
const FDS_PORT = 4304;
const WKMS_PORT = 4404;
const DB = 'front_desk_test';
const BOOKING = 'dd019500-0000-4000-8000-000000000101';
const STAFF = '66666666-6666-4666-8666-666666666666';
const WKMS_PIN = '3f6cf798873979974261fa5429d468dbd24f1d5c';
const BASE = `http://127.0.0.1:${FDS_PORT}`;
const OBS = [];
const STARTED = new Date().toISOString();
const TEST_USER = `rcv${crypto.randomBytes(6).toString('hex')}`;
const TEST_PASSWORD = crypto.randomBytes(32).toString('hex');
const TEST_JWT_SECRET = crypto.randomBytes(48).toString('hex');
const AMQP_URL = `amqp://${TEST_USER}:${TEST_PASSWORD}@127.0.0.1:${AMQP_PORT}`;
const REPORT_DIR = path.join(ROOT, 'evidence', 'fds-messaging-realtime');
let wdir, wkmsRoot, fdsProcess, wkmsProcess, conn, channel, socket;
let fdsLog = '', wkmsLog = '', baselineId, postId, received = new Set();
let restarted = false, autoRecovered = false, postDelivered = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function exec(cmd, args, opt = {}) {
  const p = cp.spawnSync(cmd, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 120000,
    maxBuffer: 16 * 1024 * 1024, ...opt,
  });
  if (p.error || p.status !== 0) {
    throw new Error(`${cmd} failed: ${(p.stderr || p.stdout || p.error?.message || '').slice(-1200)}`);
  }
  return (p.stdout || '').trim();
}
const docker = (...args) => exec('docker', args);
const dbsql = (sql) => docker('exec', DB_CONTAINER, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB, '-Atc', sql);
async function until(predicate, {timeout = 25000, interval = 500, label = 'condition'} = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (_) { /* transient */ }
    await delay(interval);
  }
  throw new Error(`Timeout: ${label}`);
}
async function portUsed(port) {
  return new Promise(resolve => {
    const s = net.connect({host: '127.0.0.1', port});
    const t = setTimeout(() => { s.destroy(); resolve(false); }, 1500);
    s.once('connect', () => { clearTimeout(t); s.destroy(); resolve(true); });
    s.once('error', () => { clearTimeout(t); s.destroy(); resolve(false); });
  });
}
function redact(s) {
  return String(s || '').replaceAll(TEST_PASSWORD, '[REDACTED]')
    .replaceAll(TEST_JWT_SECRET, '[REDACTED]')
    .replaceAll(TEST_USER, '[REDACTED_USER]');
}
function result(id, title, status, detail = '') {
  const clean = redact(detail).replaceAll(/[\r\n]+/g, ' ').slice(0, 750);
  OBS.push({id, title, status, detail: clean});
  console.log(`${status.padEnd(7)} ${id} ${title}${clean ? ' — ' + clean : ''}`);
}
async function test(id, title, fn) {
  try { result(id, title, 'PASS', await fn()); }
  catch (e) { result(id, title, 'FAIL', e.message); }
}
const blocked = (id, title, reason) => result(id, title, 'BLOCKED', reason);
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({alg: 'HS256', typ: 'JWT'});
  const p = b64({sub: STAFF, role: 'RECEPTIONIST', iss: 'forever-hotel-auth', iat: now, exp: now + 3600});
  const sig = crypto.createHmac('sha256', TEST_JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
async function http(relative) {
  const a = new AbortController();
  const t = setTimeout(() => a.abort(), 4500);
  try {
    const resp = await fetch(`${BASE}${relative}`, {
      headers: {Authorization: `Bearer ${token()}`}, signal: a.signal,
    });
    let body; try {body = await resp.json();} catch {body = null;}
    return {code: resp.status, body};
  } finally {clearTimeout(t);}
}
function launch(script, cwd, env, service, args = []) {
  const p = cp.spawn(process.execPath, [script, ...args], {cwd, env, stdio: ['ignore', 'pipe', 'pipe']});
  const update = b => {
    if (service === 'fds') fdsLog = (fdsLog + String(b)).slice(-18000);
    else wkmsLog = (wkmsLog + String(b)).slice(-18000);
  };
  p.stdout.on('data', update); p.stderr.on('data', update);
  return p;
}
function fdsEnv() {
  const env = {
    ...process.env, NODE_ENV: 'test', PORT: String(FDS_PORT),
    DB_HOST: '127.0.0.1', DB_PORT: String(DB_PORT),
    DB_USERNAME: TEST_USER, DB_PASSWORD: TEST_PASSWORD,
    DB_NAME: DB, DB_SSL: 'false', DB_SYNCHRONIZE: 'false', DB_LOGGING: 'false',
    JWT_SECRET: TEST_JWT_SECRET, JWT_ISSUER: 'forever-hotel-auth',
    FDS_AUTH_PROVIDER: 'legacy',
    RABBITMQ_ENABLED: 'true', RABBITMQ_URL: AMQP_URL,
    RABBITMQ_EXCHANGE: 'forever.events',
    WKMS_INTEGRATION_ENABLED: 'false',
    FDS_ALLOWED_ORIGINS: 'http://localhost:3102,http://127.0.0.1:3102',
  };
  delete env.DATABASE_URL;
  return env;
}
function wkmsEnv() {
  return {
    ...process.env, NODE_ENV: 'test', PORT: String(WKMS_PORT),
    DATABASE_URL: `postgresql://${TEST_USER}:${TEST_PASSWORD}@127.0.0.1:${DB_PORT}/${DB}`,
    JWT_SECRET: TEST_JWT_SECRET,
    RABBITMQ_ENABLED: 'true', RABBITMQ_URL: AMQP_URL, RABBITMQ_EXCHANGE: 'forever.events',
  };
}
async function startFds() {
  const nest = path.join(BACK, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  // Nest CLI requires the explicit 'start' command (Phase B uses the same form).
  fdsLog = '';
  fdsProcess = launch(nest, BACK, fdsEnv(), 'fds', ['start']);
  try {
    await until(async () => {
      if (fdsProcess.exitCode !== null) return false;
      const x = await http('/health/ready');
      return x.code === 200 && x.body?.database === 'up';
    }, {timeout: 90000, label: 'FDS backend readiness'});
  } catch (error) {
    throw new Error(`${error.message}; FDS process exitCode=${fdsProcess.exitCode}; startup log: ${redact(fdsLog.slice(-2500))}`);
  }
}
async function startWkms() {
  wkmsLog = '';
  wkmsProcess = launch(path.join(wkmsRoot, 'dist', 'main.js'), wkmsRoot, wkmsEnv(), 'wkms');
  try {
    await until(async () => {
      if (wkmsProcess.exitCode !== null) return false;
      const a = new AbortController();
      const t = setTimeout(() => a.abort(), 1800);
      try {const r = await fetch(`http://127.0.0.1:${WKMS_PORT}/health/ready`, {signal: a.signal});return r.status === 200;}
      finally {clearTimeout(t);}
    }, {timeout: 70000, label: 'WKMS backend readiness'});
  } catch (error) {
    throw new Error(`${error.message}; WKMS process exitCode=${wkmsProcess.exitCode}; startup log: ${redact(wkmsLog.slice(-2500))}`);
  }
}
async function socketConnect() {
  const {io} = require(path.join(BACK, 'node_modules', 'socket.io-client'));
  socket = io(`${BASE}/realtime`, {
    autoConnect: false, transports: ['websocket'], reconnection: false,
    auth: {token: token()}, timeout: 7000,
  });
  socket.on('task.escalated', e => {if (e?.data?.taskId) received.add(e.data.taskId);});
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {done(); reject(Error('No authenticated Socket.IO readiness'));}, 12000);
    function done() {clearTimeout(timer);socket.off('realtime.ready', ready);socket.off('connect_error', bad);}
    function ready() {done();resolve();}
    function bad(e) {done();reject(Error('Socket.IO authentication failure: ' + e.message));}
    socket.once('realtime.ready', ready);socket.once('connect_error', bad);socket.connect();
  });
}
async function openRabbit() {
  const amqp = require(path.join(BACK, 'node_modules', 'amqplib'));
  conn = await amqp.connect(AMQP_URL);
  // Restarts close channels asynchronously; attach listeners so the *test harness* doesn't crash.
  conn.on('error', () => {});
  channel = await conn.createConfirmChannel();
  channel.on('error', () => {});
}
async function closeRabbit() {
  try { await channel?.close(); } catch {}
  try { await conn?.close(); } catch {}
  channel = null;conn = null;
}
async function queue(name) {return channel.checkQueue(name);}
function event(id) {
  const t = new Date().toISOString();
  return {
    eventId: `escalation:${id}`, eventType: 'task.escalated', eventVersion: 1,
    occurredAt: t, source: 'worker-management',
    data: {taskId: id, taskCategory: 'ROOM_CLEANING', roomNumber: 'R1951', priority: 'HIGH', escalatedAt: t},
  };
}
async function publishEscalation(id) {
  const e = event(id);
  channel.publish('forever.events', 'wkms.task.escalated.v1', Buffer.from(JSON.stringify(e)), {
    messageId: e.eventId, contentType: 'application/json', persistent: true,
  });
  await channel.waitForConfirms();
}
async function seenInRest(id) {
  const r = await http('/realtime/escalations');
  return r.code === 200 && Array.isArray(r.body) && r.body.some(e => e?.data?.taskId === id);
}
async function stopChild(p) {
  if (!p) return;
  try {
    if (process.platform === 'win32') {
      cp.spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], {stdio: 'ignore', timeout: 12000});
    } else p.kill('SIGTERM');
  } catch {}
}
function statusCount(s) {return OBS.filter(x => x.status === s).length;}
function evidence() {
  fs.mkdirSync(REPORT_DIR, {recursive: true});
  const csv = [['test_id', 'scenario', 'status', 'observed_result'],
    ...OBS.map(x => [x.id, x.title, x.status, x.detail])]
    .map(a => a.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(REPORT_DIR, 'phase-c-execution-register.csv'), csv, 'utf8');
  const md = [
    '# DDP-203 Phase C — RabbitMQ Restart and Recovery', '',
    `Executed: ${STARTED}`,
    `FDS branch: ${EXPECTED_BRANCH}`,
    `WKMS pinned develop SHA: ${WKMS_PIN}`,
    'Environment: Plan 03 disposable local PostgreSQL 127.0.0.1:55434 and RabbitMQ 127.0.0.1:5673; temporary FDS 4304 and WKMS 4404.',
    'Original .env and Neon untouched. RabbitMQ restart applies ONLY to container fds-ddp203-rabbitmq.',
    `Broker restart executed: ${restarted ? 'YES' : 'NO'}`,
    '',
    `**Results: ${statusCount('PASS')} PASS, ${statusCount('FAIL')} FAIL, ${statusCount('BLOCKED')} BLOCKED.**`,
    '', ...OBS.map(x => `- **${x.status}** ${x.id}: ${x.title} — ${x.detail}`), '',
    '## Interpretation',
    '- A pre-restart delivery is not proof of automatic post-restart recovery.',
    '- WKMS consumer reconnection and FDS consumer reconnection are evaluated separately.',
    '- A queued message consumed only after restarting FDS is manual recovery, NOT automatic recovery.',
    '- Socket reconnect and REST state checks do not establish durable escalation persistence across process restarts.',
    '- FDS automatic recovery failures require code remediation and a fresh isolated retest; do not overwrite earlier evidence.',
    '- Actual WKMS service-request REST/assignment (W04) and receptionist browser experience (R06) remain separate.',
    '', '## Safety',
    '- The broker is restarted, not removed; PostgreSQL is not restarted or cleared.',
    '- Disposable containers are retained. Never rerun Plan 03 seed or Phase B on these containers.',
    '- Test-only passwords and JWTs are excluded from this evidence.',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(REPORT_DIR, 'phase-c-verification.md'), md, 'utf8');
}

async function setup() {
  assert(process.argv.includes('--allow-isolated-restart'), 'Explicit --allow-isolated-restart required');
  assert(exec('git', ['branch', '--show-current']) === EXPECTED_BRANCH, 'Wrong FDS branch');
  assert(fs.existsSync(path.join(REPORT_DIR, 'verification.md')), 'Missing Phase A report');
  assert(fs.existsSync(path.join(REPORT_DIR, 'phase-b-verification.md')), 'Missing Phase B report');
  assert(!fs.existsSync(path.join(REPORT_DIR, 'phase-c-verification.md')), 'Phase C evidence already exists; refusing to overwrite');
  assert(!fs.existsSync(path.join(REPORT_DIR, 'phase-c-execution-register.csv')), 'Phase C register already exists');
  assert(fs.existsSync(path.join(BACK, 'node_modules', 'amqplib')), 'FDS backend node_modules missing');
  for (const p of [FDS_PORT, WKMS_PORT]) assert(!(await portUsed(p)), `Port ${p} already in use`);
  assert(docker('port', DB_CONTAINER, '5432/tcp').includes('127.0.0.1:55434'), 'Wrong PostgreSQL container mapping');
  assert(docker('port', RABBIT_CONTAINER, '5672/tcp').includes('127.0.0.1:5673'), 'Wrong RabbitMQ container mapping');
  assert(dbsql('SELECT current_database()') === DB, 'Wrong isolated database');
  assert(dbsql("SELECT count(*) FROM bookings WHERE booking_id::text LIKE 'dd019500-%'") === '6', 'Synthetic fixtures mismatch');
  assert(dbsql(`SELECT status::text FROM bookings WHERE booking_id='${BOOKING}'`) === 'CHECKED_OUT', 'Phase B synthetic booking is not checked out');
  assert(dbsql(`SELECT count(*) FROM wkms_tasks WHERE booking_id='${BOOKING}' AND source='CHECKOUT_TRIGGER'`) === '1', 'Expected one persisted WKMS task from Phase B');
  assert(dbsql("SELECT (to_regclass('public.wkms_event_outbox') IS NOT NULL)::text") === 'true', 'WKMS outbox table missing');
  // Fail closed if anyone else is connected to this broker. Do not disrupt other test/service users.
  const connections = docker('exec', RABBIT_CONTAINER, 'rabbitmqctl', '-q', 'list_connections', '--formatter=json', 'name');
  const found = JSON.parse(connections);
  assert(Array.isArray(found), 'Could not verify existing RabbitMQ connections safely');
  assert(found.length === 0, `Broker has ${found.length} existing connections: refusing to restart it`);
  console.log('PASS: Disposable containers, fixtures, no competing broker connections confirmed.');
  // Create non-privileged test credentials on disposable containers; old Phase A/B credentials remain untouched.
  dbsql(`CREATE ROLE ${TEST_USER} LOGIN PASSWORD '${TEST_PASSWORD}'`);
  dbsql(`GRANT CONNECT ON DATABASE ${DB} TO ${TEST_USER}`);
  dbsql(`GRANT USAGE ON SCHEMA public TO ${TEST_USER}`);
  dbsql(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${TEST_USER}`);
  dbsql(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${TEST_USER}`);
  docker('exec', RABBIT_CONTAINER, 'rabbitmqctl', 'add_user', TEST_USER, TEST_PASSWORD);
  docker('exec', RABBIT_CONTAINER, 'rabbitmqctl', 'set_permissions', '-p', '/', TEST_USER, '.*', '.*', '.*');
  // Clone independently; verify the exact inspected commit instead of executing unreviewed code.
  wdir = fs.mkdtempSync(path.join(os.tmpdir(), 'fds-ddp203-rcv-wkms-'));
  wkmsRoot = path.join(wdir, 'backend');
  console.log('Cloning pinned WKMS develop and building temporary test backend...');
  // Clone the full develop ancestry without checking out the latest code.
  // The reviewed WKMS_PIN is two commits behind develop (DDP-196 was merged since).
  // Avoid --depth 1: that shallow clone cannot check out the reviewed ancestor.
  exec('git', ['clone', '--single-branch', '--branch', 'develop', '--no-checkout',
    'https://github.com/forever-hotel/worker-management.git', wdir], {timeout: 240000});
  // Fail closed if the pinned commit is no longer reachable on develop.
  exec('git', ['cat-file', '-e', `${WKMS_PIN}^{commit}`], {cwd: wdir, timeout: 30000});
  exec('git', ['checkout', '--detach', WKMS_PIN], {cwd: wdir, timeout: 120000});
  assert(exec('git', ['rev-parse', 'HEAD'], {cwd: wdir}) === WKMS_PIN,
    'WKMS pinned checkout mismatch; stop for inspection');
  console.log(`PASS: Checked out reviewed WKMS commit ${WKMS_PIN.slice(0, 8)} instead of current develop.`);
  assert(JSON.parse(fs.readFileSync(path.join(wkmsRoot, 'package.json'), 'utf8')).scripts.build === 'nest build', 'Unexpected WKMS build script');
  const npm = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const prefix = process.platform === 'win32' ? ['/d', '/c', 'npm'] : [];
  exec(npm, [...prefix, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: wkmsRoot, timeout: 900000});
  // Invoke the pinned NestJS CLI directly; do not run npm prebuild/postbuild hooks.
  exec(process.execPath, [path.join(wkmsRoot, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'), 'build'],
    {cwd: wkmsRoot, timeout: 500000});
  assert(fs.existsSync(path.join(wkmsRoot, 'dist', 'main.js')), 'WKMS build output absent');
  console.log('Starting real FDS/WKMS NestJS applications...');
  await startFds(); await startWkms();
  await openRabbit(); await socketConnect();
  await until(async () => (await queue('fds.task-escalation.v1')).consumerCount === 1 &&
    (await queue('wkms.checkout-completed.v1')).consumerCount === 1,
    {timeout: 22000, label: 'One FDS and one WKMS RabbitMQ consumer'});
  console.log('PASS: FDS, WKMS, two RabbitMQ consumers and authenticated socket ready.');
}
async function runChecks() {
  await test('M09-01', 'Baseline FDS escalation before broker restart', async () => {
    baselineId = crypto.randomUUID();
    await publishEscalation(baselineId);
    await until(async () => received.has(baselineId) && await seenInRest(baselineId),
      {timeout: 14000, label: 'baseline FDS Socket.IO and REST event'});
    return 'Broker -> real FDS consumer -> authenticated Socket.IO and REST delivered before restart';
  });
  await test('M09-02', 'Controlled isolated broker restart and queue survival', async () => {
    assert(docker('port', RABBIT_CONTAINER, '5672/tcp').includes('127.0.0.1:5673'), 'Broker port mapping changed');
    await closeRabbit();
    console.log('Restarting ONLY disposable fds-ddp203-rabbitmq (not PostgreSQL)...');
    restarted = true;
    docker('restart', '--time', '3', RABBIT_CONTAINER);
    await until(async () => {
      try { await openRabbit(); return true; } catch { await closeRabbit(); return false; }
    }, {timeout: 70000, interval: 1800, label: 'RabbitMQ network connection after restart'});
    const a = await queue('fds.task-escalation.v1');
    const b = await queue('wkms.checkout-completed.v1');
    assert(a && b, 'Durable queues missing');
    return 'Broker returned; FDS and WKMS durable queues still exist';
  });
  await test('M09-03', 'WKMS checkout consumer automatically reconnects', async () => {
    assert(restarted, 'Broker restart did not occur');
    await until(async () => (await queue('wkms.checkout-completed.v1')).consumerCount >= 1,
      {timeout: 39000, label: 'WKMS consumer recovery without WKMS restart'});
    const t = new Date().toISOString();
    const evt = {eventId: `checkout:${BOOKING}`, eventType:'checkout.completed',eventVersion:1,
      occurredAt:t, source:'front-desk', data:{bookingReference:BOOKING,roomNumber:'R1951',
      taskCategory:'ROOM_CLEANING',priority:'HIGH',sourceType:'CHECKOUT_TRIGGER'}};
    channel.publish('forever.events', 'fds.checkout.completed.v1', Buffer.from(JSON.stringify(evt)),
      {persistent:true, messageId:evt.eventId, contentType:'application/json'});
    await channel.waitForConfirms();
    await until(async () => (await queue('wkms.checkout-completed.v1')).messageCount === 0,
      {timeout: 13000, label: 'WKMS duplicate delivery ack'});
    const count = dbsql(`SELECT count(*) FROM wkms_tasks WHERE booking_id='${BOOKING}' AND source='CHECKOUT_TRIGGER'`);
    assert(count === '1', 'WKMS created duplicate task after broker restart');
    return 'Real WKMS re-subscribed and consumed duplicate checkout without creating a second task';
  });
  await test('M09-04', 'FDS escalation consumer automatically reconnects', async () => {
    assert(restarted, 'Broker restart did not occur');
    await until(async () => (await queue('fds.task-escalation.v1')).consumerCount >= 1,
      {timeout: 24000, label: 'FDS escalation consumer recovery without FDS restart'});
    autoRecovered = true;
    return 'Real FDS consumer re-subscribed without application restart';
  });
  await test('M09-05', 'Post-restart escalation reaches live FDS Socket.IO and REST', async () => {
    assert(restarted, 'Broker restart did not occur');
    postId = crypto.randomUUID();
    await publishEscalation(postId);
    await until(async () => received.has(postId) && await seenInRest(postId),
      {timeout: 17000, label: 'FDS post-restart Socket.IO + REST delivery'});
    postDelivered = true;
    return 'A NEW escalation was actually delivered after restart; not just queue presence';
  });
  if (postDelivered) {
    blocked('M09-06', 'Manual FDS restart replays queued event', 'Not applicable: live FDS consumed the post-restart message automatically');
  } else if (!postId) {
    blocked('M09-06', 'Manual FDS restart replays queued event', 'No post-restart event was published; cannot test replay safely');
  } else {
    await test('M09-06', 'Manual FDS restart recovers queued escalation (fallback only)', async () => {
      const pending = await queue('fds.task-escalation.v1');
      assert(pending.messageCount >= 1, 'No pending escalation to replay after FDS restart');
      try { socket.disconnect(); } catch {}
      await stopChild(fdsProcess);
      await until(async () => !(await portUsed(FDS_PORT)), {timeout: 20000, label: 'old FDS process stopped'});
      fdsLog = '';
      await startFds();
      await until(async () => (await queue('fds.task-escalation.v1')).consumerCount >= 1,
        {timeout: 17000, label: 'FDS consumer after manual application restart'});
      await socketConnect();
      await until(async () => await seenInRest(postId),
        {timeout: 15000, label: 'queued FDS escalation visible via REST after restart'});
      return 'Manual FDS restart recovered queued durable escalation; NOT automatic reconnection';
    });
  }
  blocked('W04', 'WKMS service-request REST and manual assignment', 'WKMS develop lacks required internal REST routes; not tested by Phase C');
  blocked('R06', 'Real Front Desk receptionist browser UX', 'Requires separate manual browser testing with a valid user session');
}

(async () => {
  let completed = false;
  try {
    await setup();
    await runChecks();
    completed = true;
  } catch (e) {
    const detail = redact(e.stack || e.message).slice(-1300);
    console.error('SETUP/EXECUTION FAILURE:', detail);
    result('SETUP', 'Phase C environment or execution', 'FAIL', detail);
  } finally {
    try { evidence(); console.log('Evidence:', REPORT_DIR); }
    catch (e) {console.error('Evidence write failure:', redact(e.message)); completed = false;}
    try {socket?.disconnect();} catch {}
    await closeRabbit();
    await stopChild(fdsProcess);
    await stopChild(wkmsProcess);
    console.log(`Phase C: ${statusCount('PASS')} PASS, ${statusCount('FAIL')} FAIL, ${statusCount('BLOCKED')} BLOCKED`);
    console.log('Disposable DB and RabbitMQ containers retained, even if recovery checks fail.');
    process.exitCode = completed && statusCount('FAIL') === 0 ? 0 : 1;
  }
})();
