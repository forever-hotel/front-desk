'use strict';
// DDP-202 / original plan DDP-196. One-run FDS core acceptance on disposable LOCAL PostgreSQL only.
// Requires Node 24+, Docker Desktop, and execution from the front-desk repository root.
// Does not load or write backend/.env; overrides all database settings for the spawned backend.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const net = require('node:net');

const ROOT = process.cwd();
const BACK = path.join(ROOT, 'backend');
const CONTAINER = 'fds-core-acceptance';
const DB_PORT = 55433;
const HTTP_PORT = 4301;
const DB = 'front_desk_test';
const RECEPTIONIST = '66666666-6666-4666-8666-666666666666';
const MANAGER = '77777777-7777-4777-8777-777777777777';
const B101 = 'dd019500-0000-4000-8000-000000000101';
const B102 = 'dd019500-0000-4000-8000-000000000102';
const RT = 'dd019500-0000-4000-8000-000000000001';
const BASE = `http://127.0.0.1:${HTTP_PORT}`;
const RESULTS = [];
const startedAt = new Date();
let app = null; let pool = null; let hasDocker = false;

function must(b, why) { if (!b) throw new Error(why); }
function command(command, args, env = process.env, opts = {}) {
  const p = cp.spawnSync(command, args, {cwd: ROOT, env, encoding:'utf8', timeout:180000, maxBuffer:12*1024*1024, ...opts});
  if (p.error || p.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${p.error?.message || p.stderr?.slice(-1800) || p.stdout?.slice(-1800)}`);
  return p.stdout.trim();
}
function docker(...args) {return command('docker',args)}
function psql(sql) {
  return docker('exec',CONTAINER,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-Atc',sql);
}
function copyAndRun(file) {
  must(fs.existsSync(file), `Missing SQL: ${file}`);
  const name = path.basename(file);
  docker('cp',file,`${CONTAINER}:/tmp/${name}`);
  docker('exec',CONTAINER,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-f',`/tmp/${name}`);
}
function b64(x) {return Buffer.from(JSON.stringify(x)).toString('base64url')}
function jwt(secret,role,sub) {
  const now=Math.floor(Date.now()/1000);
  const h=b64({typ:'JWT',alg:'HS256'}),p=b64({iss:'forever-hotel-auth',sub,role,iat:now,exp:now+7200});
  const sig=crypto.createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
async function api(method, endpoint, token, body) {
  const headers = {'content-type':'application/json'};
  if(token)headers.authorization=`Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),15000);
  try {
    const resp=await fetch(BASE+endpoint, {method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const raw=await resp.text();let json;try{json=JSON.parse(raw)}catch{json={raw:raw.slice(0,400)}}
    return {status:resp.status,data:json};
  } finally {clearTimeout(timer)}
}
async function check(id, label, task) {
  try {const note=await task(); RESULTS.push({id,label,result:'PASS',note:String(note||'')});console.log(`PASS ${id} ${label}`)}
  catch(e){RESULTS.push({id,label,result:'FAIL',note:String(e.message||e).slice(0,600)});console.error(`FAIL ${id} ${label}: ${String(e.message||e)}`)}
}
async function query(sql, params=[]) {return (await pool.query(sql,params)).rows}
async function one(sql, params=[]){const a=await query(sql,params); must(a[0],'Expected database row absent');return a[0]}
async function expectHttp(method,endpoint,token,body,allowed) {
  const r=await api(method,endpoint,token,body);
  must(allowed.includes(r.status),`${method} ${endpoint} expected ${allowed.join('/')} got ${r.status}: ${JSON.stringify(r.data).slice(0,300)}`);
  return r.data;
}
async function portInUse(port) {
  return await new Promise(resolve=>{let s=net.connect({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>{s.destroy();resolve(false)});setTimeout(()=>{s.destroy();resolve(false)},1000)})
}
function evidence() {
  const out=path.join(ROOT,'evidence','fds-core-acceptance');fs.mkdirSync(out,{recursive:true});
  const rows=RESULTS.map(x=>[x.id,x.label,x.result,x.note]);
  const csv = [['case_id','description','status','notes'],...rows].map(a=>a.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
  fs.writeFileSync(path.join(out,'execution-register.csv'),csv);
  const count=x=>RESULTS.filter(r=>r.result===x).length;
  const md=`# FDS Plan 02 — Local Core Lifecycle Verification\n\nExecuted: ${startedAt.toISOString()}\nEnvironment: isolated disposable Docker PostgreSQL 16 / ${DB} / 127.0.0.1:${DB_PORT}; FDS backend 127.0.0.1:${HTTP_PORT}.\nNo Neon credentials used; RabbitMQ and WKMS disabled.\nThese are local real database/API tests, not proof of live FOSS/payment/printing/integration.\n\n**Result: ${count('PASS')} passed, ${count('FAIL')} failed.**\n\n${RESULTS.map(r=>`- **${r.result}** ${r.id}: ${r.label}${r.note?` — ${r.note}`:''}`).join('\n')}\n\n## Manual and deferred checks\n- Actual Front Desk browser UI, gateway/BFF, loading/error/keyboard/mobile checks: NOT RUN by this script.\n- Live payment gateway failure, physical printing, external FOSS/WKMS: BLOCKED/CONTRACT-ONLY; mocks are not integrations.\n- Concurrency and alternate payment scenario: supported by existing automated suites; require additional manual execution evidence if claimed.\n- Neon test branch missing migration records is a separately tracked DDP-195 finding.\n- Complete SRS FD-01–FD-19 traceability by reviewing the approved SRS; not asserted here.\n`;
  fs.writeFileSync(path.join(out,'verification.md'),md);return out;
}
async function stopApp(){if(!app)return;try{if(process.platform==='win32')cp.spawnSync('taskkill',['/PID',String(app.pid),'/T','/F'],{stdio:'ignore'});else app.kill('SIGTERM')}catch{}app=null}
async function start() {
  must(fs.existsSync(path.join(BACK,'package.json')) && fs.existsSync(path.join(BACK,'node_modules','pg')), 'Run from front-desk repository root after backend npm ci');
  must(fs.existsSync(path.join(BACK,'test','database','fixtures','ddp195','01_seed.sql')), 'DDP-195 fixture files missing; pull develop first');
  must(!(await portInUse(HTTP_PORT)),'Port 4301 is busy; stop other services to avoid contacting the wrong backend');
  must(!(await portInUse(DB_PORT)),'Port 55433 is already in use; do not connect to an unknown DB');
  const inspect=cp.spawnSync('docker',['container','inspect',CONTAINER],{encoding:'utf8'});
  must(inspect.status!==0,`Container ${CONTAINER} already exists. This run requires a FRESH database. Review before docker rm -f ${CONTAINER}`);
  docker('version','--format','{{.Server.Version}}');
  console.log('Starting fresh localhost-only disposable PostgreSQL container...');
  docker('run','-d','--name',CONTAINER,'--rm','-e','POSTGRES_USER=postgres','-e','POSTGRES_PASSWORD=ddp202_local_only','-e',`POSTGRES_DB=${DB}`,'-p','127.0.0.1:55433:5432','postgres:16');hasDocker=true;
  let ready=false;
  for(let i=0;i<40;i++){let p=cp.spawnSync('docker',['exec',CONTAINER,'pg_isready','-U','postgres','-d',DB],{encoding:'utf8'});if(p.status===0){ready=true;break}await new Promise(r=>setTimeout(r,500))}
  must(ready,'Local PostgreSQL container did not become ready');
  const actual=psql('SELECT current_database()');must(actual===DB,'Unexpected database identity');
  const port=docker('port',CONTAINER,'5432/tcp'); must(port.includes('127.0.0.1:55433'),'Database is not bound to the expected localhost port');
  copyAndRun(path.join(BACK,'test','database','shared-schema.sql'));
  const env={...process.env,DB_HOST:'127.0.0.1',DB_PORT:String(DB_PORT),DB_USERNAME:'postgres',DB_PASSWORD:'ddp202_local_only',DB_NAME:DB,DB_SSL:'false',DB_SYNCHRONIZE:'false',DB_LOGGING:'false',NODE_ENV:'test',RABBITMQ_ENABLED:'false',WKMS_INTEGRATION_ENABLED:'false',FDS_AUTH_PROVIDER:'legacy',PORT:String(HTTP_PORT),JWT_ISSUER:'forever-hotel-auth',JWT_SECRET:crypto.randomBytes(48).toString('hex')};
  delete env.DATABASE_URL;
  console.log('Applying LOCAL TypeORM migrations...');
  command(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/c','npm','run','migration:run']:['run','migration:run'],env,{cwd:BACK});
  copyAndRun(path.join(BACK,'test','database','seed.sql'));
  const source=fs.readFileSync(path.join(BACK,'test','database','fixtures','ddp195','01_seed.sql'),'utf8');
  must(source.includes("current_database() <> 'forever'"),'Unexpected seed safety guard; refuse modification');
  const temp=path.join(os.tmpdir(),'fds_plan02_local_seed.sql');
  fs.writeFileSync(temp,source.replace("current_database() <> 'forever'",`current_database() <> '${DB}'`),'utf8');
  try{copyAndRun(temp)}finally{try{fs.unlinkSync(temp)}catch{}}
  const loaded=psql("SELECT COUNT(*) FROM bookings WHERE booking_id::text LIKE 'dd019500-%'");must(loaded==='6','DDP-195 test records not found in disposable DB');
  console.log('Starting FDS NestJS against ONLY local PostgreSQL...');
  const nestBin=path.join(BACK,'node_modules','@nestjs','cli','bin','nest.js');must(fs.existsSync(nestBin),'Nest CLI is missing');
  app=cp.spawn(process.execPath,[nestBin,'start'],{cwd:BACK,env,stdio:['ignore','pipe','pipe']});
  let log='';app.stdout.on('data',b=>{log+=b.toString();if(log.length>12000)log=log.slice(-12000)});app.stderr.on('data',b=>{log+=b.toString();if(log.length>12000)log=log.slice(-12000)});
  let up=false;for(let i=0;i<180;i++){if(app.exitCode!==null)break;try{const r=await api('GET','/health/ready');if(r.status===200&&r.data?.database==='up'){up=true;break}}catch{}await new Promise(r=>setTimeout(r,500))}
  must(up,`NestJS local startup failed: ${log.slice(-2200)}`);
  const {Pool}=require(path.join(BACK,'node_modules','pg'));
  pool=new Pool({host:'127.0.0.1',port:DB_PORT,user:'postgres',password:'ddp202_local_only',database:DB,ssl:false,max:3});
  const dbId=await one('SELECT current_database() AS db');must(dbId.db===DB,'Direct SQL host/database mismatch');
  return env.JWT_SECRET;
}
async function tests(secret) {
 const clerk=jwt(secret,'RECEPTIONIST',RECEPTIONIST);
 const mgr=jwt(secret,'MANAGER',MANAGER);
 await check('FDS-00','Backend readiness',async()=>{const x=await expectHttp('GET','/health/ready',null,undefined,[200]);must(x.database==='up'&&x.status==='ready','Unhealthy database');return 'ready/up'});
 await check('FDS-02a','Missing JWT rejected',async()=>{await expectHttp('GET','/bookings/search?query=DDP195',null,undefined,[401])});
 await check('FDS-22a','Manager GET permitted',async()=>{await expectHttp('GET','/rooms/status',mgr,undefined,[200])});
 await check('FDS-22b','Manager write forbidden',async()=>{await expectHttp('PATCH','/rooms/R1951/status',mgr,{targetStatus:'UNDER_MAINTENANCE',performedBy:MANAGER},[403])});
 await check('FDS-22c','Invalid JWT rejected',async()=>{await expectHttp('GET','/rooms/status','invalid.fake.jwt',undefined,[401])});
 await check('FDS-02b','Search persisted synthetic guest',async()=>{const x=await expectHttp('GET','/bookings/search?query=DDP195%20Test%20Guest',clerk,undefined,[200]);must(Array.isArray(x)&&x.length>=1,'No search results');return `${x.length} results`});
 await check('FDS-02c','Search nonexistent booking',async()=>{const x=await expectHttp('GET','/bookings/search?query=DDP202NoSuchGuest998877',clerk,undefined,[200]);must(Array.isArray(x)&&x.length===0,'Expected empty result')});
 await check('FDS-03a','Recent bookings response',async()=>{const x=await expectHttp('GET','/bookings/recent?limit=5',clerk,undefined,[200]);must(Array.isArray(x.value)&&x.count<=5,'Unexpected recent shape');return `${x.count} recent`});
 await check('FDS-03b','Today arrivals includes DDP-195',async()=>{const x=await expectHttp('GET','/bookings/arrivals?date=2026-10-27',clerk,undefined,[200]);must(Array.isArray(x)&&x.some(b=>b.bookingReference===B101),'Expected arrival missing')});
 await check('FDS-03c','Today departures includes DDP-195',async()=>{const x=await expectHttp('GET','/bookings/departures?date=2026-10-27',clerk,undefined,[200]);must(Array.isArray(x)&&x.some(b=>b.bookingReference===B102),'Expected departure missing')});
 await check('FDS-08','Room board reflects database',async()=>{const x=await expectHttp('GET','/rooms/status',clerk,undefined,[200]);must(Array.isArray(x)&&x.some(r=>r.roomNumber==='R1954'&&r.status==='UNDER_MAINTENANCE'),'Expected maintenance room missing')});
 await check('FDS-06a','Scanned copy without storage key rejected',async()=>{await expectHttp('POST','/check-in',clerk,{bookingReference:B101,verification:{documentType:'PASSPORT',verificationMethod:'SCANNED_COPY',verifiedBy:RECEPTIONIST}},[400]);const a=await one('SELECT status::text AS status FROM bookings WHERE booking_id=$1',[B101]);must(a.status==='CONFIRMED','Rejected check-in changed booking')});
 await check('FDS-09a','Clear maintenance with audit',async()=>{await expectHttp('PATCH','/rooms/R1954/status',clerk,{targetStatus:'VACANT',performedBy:RECEPTIONIST},[200]);const a=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1954'");must(a.status==='VACANT','Maintenance clear did not persist')});
 await check('FDS-09b','Block maintenance with audit',async()=>{await expectHttp('PATCH','/rooms/R1954/status',clerk,{targetStatus:'UNDER_MAINTENANCE',performedBy:RECEPTIONIST},[200]);const a=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1954'");must(a.status==='UNDER_MAINTENANCE','Maintenance block did not persist');const b=await one("SELECT count(*)::int AS count FROM audit_logs WHERE entity_id='R1954' AND action IN ('ROOM_MAINTENANCE_BLOCKED','ROOM_MAINTENANCE_CLEARED')");must(b.count===2,'Expected two maintenance audits')});
 await check('FDS-09c','Occupied room cannot enter maintenance',async()=>{await expectHttp('PATCH','/rooms/R1952/status',clerk,{targetStatus:'UNDER_MAINTENANCE',performedBy:RECEPTIONIST},[409]);const a=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1952'");must(a.status==='OCCUPIED','Occupied room changed unexpectedly')});
 await check('FDS-10a','Available room lookup for checked-in booking',async()=>{const x=await expectHttp('GET',`/room-changes/${B102}/available-rooms`,clerk,undefined,[200]);must(Array.isArray(x)&&x.some(r=>r.roomNumber==='R1955'),'Expected R1955 to be eligible')});
 await check('FDS-11a','Room change to maintenance room rejected',async()=>{await expectHttp('POST','/room-changes',clerk,{bookingReference:B102,targetRoomNumber:'R1954',performedBy:RECEPTIONIST},[409]);const a=await one('SELECT room_number AS room FROM bookings WHERE booking_id=$1',[B102]);must(a.room==='R1952','Rejected room change persisted')});
 await check('FDS-10b','Transactional room reassignment',async()=>{const x=await expectHttp('POST','/room-changes',clerk,{bookingReference:B102,targetRoomNumber:'R1955',performedBy:RECEPTIONIST,reason:'DDP202 local test'},[200,201]);must(x.roomNumber==='R1955','Unexpected room-change response');const b=await one('SELECT room_number AS room FROM bookings WHERE booking_id=$1',[B102]);const old=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1952'");const newer=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1955'");must(b.room==='R1955'&&old.status==='REQUIRES_CLEANING'&&newer.status==='OCCUPIED','Room change not atomic');return 'old room cleaning, new room occupied'});
 await check('FDS-12','Folio totals are integer LKR',async()=>{const x=await expectHttp('GET',`/folios/${B102}`,clerk,undefined,[200]);must(x.currency==='LKR'&&Number.isSafeInteger(x.total),'Invalid folio total');return `LKR ${x.total}; mocked external charges`});
 await check('FDS-13a','Checkout due rejects missing payment method',async()=>{const f=await expectHttp('GET',`/folios/${B102}`,clerk,undefined,[200]);const prev=await one("SELECT COALESCE(SUM(amount),0)::int AS total FROM payments WHERE booking_id=$1 AND payment_status='COMPLETED'",[B102]);must(f.total>prev.total,'Fixture has no balance due; cannot test this rejection');await expectHttp('POST','/check-outs',clerk,{bookingReference:B102,performedBy:RECEPTIONIST},[400]);const b=await one('SELECT status::text AS status FROM bookings WHERE booking_id=$1',[B102]);must(b.status==='CHECKED_IN','Rejected checkout persisted')});
 await check('FDS-13b','Checkout persists payment and cleaning state',async()=>{const f=await expectHttp('GET',`/folios/${B102}`,clerk,undefined,[200]);const prev=await one("SELECT COALESCE(SUM(amount),0)::int AS total FROM payments WHERE booking_id=$1 AND payment_status='COMPLETED'",[B102]);const due=f.total-prev.total;must(due>0,'Expected partial-paid case');await expectHttp('POST','/check-outs',clerk,{bookingReference:B102,performedBy:RECEPTIONIST,paymentMethod:'CASH'},[200,201]);const b=await one('SELECT status::text AS status FROM bookings WHERE booking_id=$1',[B102]);const room=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1955'");const payments=await one("SELECT COUNT(*)::int AS count FROM payments WHERE booking_id=$1 AND payment_status='COMPLETED' AND amount=$2",[B102,due]);must(b.status==='CHECKED_OUT'&&room.status==='REQUIRES_CLEANING'&&payments.count>=1,'Checkout DB postconditions failed');return `Balance settled LKR ${due}`});
 await check('FDS-15','Duplicate checkout rejected without new payment',async()=>{const before=await one('SELECT COUNT(*)::int AS count FROM payments WHERE booking_id=$1',[B102]);await expectHttp('POST','/check-outs',clerk,{bookingReference:B102,performedBy:RECEPTIONIST,paymentMethod:'CASH'},[409]);const after=await one('SELECT COUNT(*)::int AS count FROM payments WHERE booking_id=$1',[B102]);must(before.count===after.count,'Duplicate checkout wrote payment')});
 await check('FDS-05','Physical ID check-in transaction',async()=>{const x=await expectHttp('POST','/check-in',clerk,{bookingReference:B101,verification:{documentType:'PASSPORT',verificationMethod:'PHYSICAL_DOCUMENT',verifiedBy:RECEPTIONIST}},[200,201]);must(x.bookingStatus==='CHECKED_IN','Unexpected check-in result');const b=await one('SELECT status::text AS status FROM bookings WHERE booking_id=$1',[B101]);const room=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1951'");const v=await one('SELECT verification_method::text AS method FROM fds_id_verifications WHERE booking_id=$1',[B101]);must(b.status==='CHECKED_IN'&&room.status==='OCCUPIED'&&v.method==='PHYSICAL_DOCUMENT','Check-in postconditions failed')});
 await check('FDS-05b','Duplicate check-in rejected',async()=>{await expectHttp('POST','/check-in',clerk,{bookingReference:B101,verification:{documentType:'PASSPORT',verificationMethod:'PHYSICAL_DOCUMENT',verifiedBy:RECEPTIONIST}},[409]);const v=await one('SELECT COUNT(*)::int AS count FROM fds_id_verifications WHERE booking_id=$1',[B101]);must(v.count===1,'Duplicate verification persisted')});
 await check('FDS-07','Print registration card contract is mock',async()=>{const x=await expectHttp('POST',`/check-in/${B101}/print`,clerk,{documentType:'REGISTRATION_CARD'},[200,201]);must(x.printJobReference?.startsWith('mock-print-')||x.status==='accepted','Unexpected mock print contract');return 'mock only — physical printer not verified'});
 await check('FDS-16','Service request blocked while WKMS disabled',async()=>{await expectHttp('POST','/service-requests',clerk,{bookingReference:B101,category:'EXTRA_TOWELS',description:'DDP202 local',performedBy:RECEPTIONIST},[503]);return 'External WKMS intentionally disabled'});
 await check('FDS-17','Worker list blocked while WKMS disabled',async()=>{await expectHttp('GET','/service-requests/available-workers',clerk,undefined,[503]);return 'External WKMS intentionally disabled'});
 await check('FDS-04a','Invalid walk-in dates rejected',async()=>{await expectHttp('POST','/bookings/walk-in',clerk,{guest:{fullName:'DDP202 Walkin',email:'ddp202-invalid@example.invalid'},booking:{roomTypeId:RT,checkInDate:'2026-10-29',checkOutDate:'2026-10-27',numGuests:1},payment:{paymentMethod:'CASH'}},[400])});
 let walkin=null;
 await check('FDS-04b','Walk-in CASH persists booking and completed payment',async()=>{const x=await expectHttp('POST','/bookings/walk-in',clerk,{guest:{fullName:'DDP202 Fictional Guest',email:'ddp202-test@example.invalid',phone:'+94000000202'},booking:{roomTypeId:RT,checkInDate:'2026-10-27',checkOutDate:'2026-10-29',numGuests:1,specialRequests:'DDP202 local acceptance'},payment:{paymentMethod:'CASH'}},[200,201]);walkin=x.bookingReference;must(x.source==='WALK_IN'&&x.status==='CONFIRMED'&&x.payment.paymentStatus==='COMPLETED','Unexpected walk-in contract');const b=await one('SELECT source::text AS source, status::text AS status FROM bookings WHERE booking_id=$1',[walkin]);must(b.source==='WALK_IN'&&b.status==='CONFIRMED','Walk-in was not persisted');return `Synthetic booking ${walkin}`});
 await check('FDS-06b','Scanned ID check-in with storage metadata',async()=>{must(walkin,'Walk-in failed; scanned scenario cannot continue');await query("INSERT INTO rooms (room_number,room_type_id,floor,status,notes) VALUES ('P202', $1,1,'VACANT','DDP202 local only')",[RT]);const x=await expectHttp('POST','/check-in',clerk,{bookingReference:walkin,roomNumber:'P202',verification:{documentType:'NIC',verificationMethod:'SCANNED_COPY',documentStorageKey:'test-only/ddp202/not-a-real-document',verifiedBy:RECEPTIONIST}},[200,201]);must(x.bookingStatus==='CHECKED_IN','Scanned check-in failed');const v=await one('SELECT verification_method::text AS method,document_storage_key AS storage FROM fds_id_verifications WHERE booking_id=$1',[walkin]);must(v.method==='SCANNED_COPY'&&v.storage.startsWith('test-only/'),'Verification metadata missing');return 'Metadata only; no real document uploaded'});
 await check('FDS-14','Fully-paid checkout produces no new payment',async()=>{must(walkin,'Walk-in not created');const before=await one('SELECT COUNT(*)::int AS count FROM payments WHERE booking_id=$1',[walkin]);const f=await expectHttp('GET',`/folios/${walkin}`,clerk,undefined,[200]);const paid=await one("SELECT COALESCE(SUM(amount),0)::int AS total FROM payments WHERE booking_id=$1 AND payment_status='COMPLETED'",[walkin]);must(f.total===paid.total,'Walk-in fixture is not fully paid');const r=await expectHttp('POST','/check-outs',clerk,{bookingReference:walkin,performedBy:RECEPTIONIST},[200,201]);must(r.bookingStatus==='CHECKED_OUT','Fully paid checkout did not complete');const after=await one('SELECT COUNT(*)::int AS count FROM payments WHERE booking_id=$1',[walkin]);const room=await one("SELECT status::text AS status FROM rooms WHERE room_number='P202'");must(before.count===after.count&&room.status==='REQUIRES_CLEANING','Unexpected payment inserted or room not cleaning');return 'No zero-value payment persisted'});
 await check('FDS-22d','Mismatched actor is forbidden',async()=>{await expectHttp('PATCH','/rooms/R1954/status',clerk,{targetStatus:'VACANT',performedBy:MANAGER},[403]);const a=await one("SELECT status::text AS status FROM rooms WHERE room_number='R1954'");must(a.status==='UNDER_MAINTENANCE','Actor mismatch changed room')});
 await check('FDS-17b','Manual task assignment blocked with WKMS disabled',async()=>{await expectHttp('POST','/service-requests/tasks/11111111-1111-4111-8111-111111111111/assign',clerk,{workerId:'67676767-6767-4676-8676-676767676767'},[503]);return 'External WKMS intentionally disabled'});
 await check('FDS-18a','Authenticated audit listing available',async()=>{const x=await expectHttp('GET','/audit-logs',clerk,undefined,[200]);must(Array.isArray(x),'Expected audit list')});
 await check('FDS-18','Audit action references persist',async()=>{const a=await one("SELECT COUNT(*)::int AS count FROM audit_logs WHERE action='CHECK_IN' AND entity_id=$1",[B101]);const b=await one("SELECT COUNT(*)::int AS count FROM audit_logs WHERE action='ROOM_CHANGE' AND entity_id=$1",[B102]);const c=await one("SELECT COUNT(*)::int AS count FROM audit_logs WHERE action='CHECK_OUT' AND entity_id=$1",[B102]);must(a.count>=1&&b.count>=1&&c.count>=1,'Missing lifecycle audit events');return 'CHECK_IN/ROOM_CHANGE/CHECK_OUT audit entries present'});
}
(async()=>{
 let code=1;
 try{const secret=await start();await tests(secret);const failures=RESULTS.filter(x=>x.result==='FAIL').length;console.log(`\nPlan 02: ${RESULTS.length-failures} PASS, ${failures} FAIL`);code=failures?1:0}
 catch(e){console.error('FATAL:',String(e.stack||e).slice(-2400));RESULTS.push({id:'SETUP',label:'Disposable integration environment',result:'FAIL',note:String(e.message||e).slice(0,600)});code=1}
 finally{try{const dir=evidence();console.log('Evidence saved:',dir)}catch(e){console.error('Evidence write failed:',e.message)} if(pool)await pool.end().catch(()=>{});await stopApp();if(hasDocker)console.log(`Local test database retained for evidence: docker rm -f ${CONTAINER} when finished.`);process.exitCode=code}
})();
