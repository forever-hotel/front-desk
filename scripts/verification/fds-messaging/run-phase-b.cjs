'use strict';
/** DDP-203 Phase B. Run from FDS repository root on issue #91 branch.
 * Reuses only the named, localhost-bound, disposable Plan 03 Docker containers.
 * Does not read or modify .env, Neon, production databases, or shared RabbitMQ.
 * Tests actual FDS checkout -> WKMS consumer -> PostgreSQL, and
 * actual WKMS escalation service -> outbox -> RabbitMQ -> FDS Socket.IO.
 */
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const cp=require('node:child_process');const net=require('node:net');const crypto=require('node:crypto');
const ROOT=process.cwd(),BACK=path.join(ROOT,'backend');
const THIS=__dirname, DB_CONTAINER='fds-ddp203-postgres',RABBIT_CONTAINER='fds-ddp203-rabbitmq';
const DB='front_desk_test', DB_PORT=55434, RABBIT_PORT=5673, FDS_PORT=4303, WKMS_PORT=4403;
const BRANCH='feature/91-fds-messaging-realtime-verification';
const BOOKING='dd019500-0000-4000-8000-000000000101', ROOM='R1951';
const STAFF='66666666-6666-4666-8666-666666666666';
const USER='bridge'+crypto.randomBytes(5).toString('hex');
const PASS=crypto.randomBytes(28).toString('hex');
const JWT_SECRET=crypto.randomBytes(48).toString('hex');
const AMQP=`amqp://${USER}:${PASS}@127.0.0.1:${RABBIT_PORT}`;
const BASE=`http://127.0.0.1:${FDS_PORT}`;
const RESULTS=[]; const RUN_AT=new Date().toISOString();
let wdir, wb, backendProc, wkmsProc, pool, rabbit, channel, socket;let backendLog='',wkmsLog='';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,why)=>{if(!ok)throw Error(why)};
const execute=(cmd,args,opts={})=>{const x=cp.spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8',timeout:600000,maxBuffer:25*1024*1024,...opts});if(x.error||x.status!==0)throw Error(`${cmd} failed: ${(x.stderr||x.stdout||x.error?.message||'').slice(-1400)}`);return (x.stdout||'').trim()};
const docker=(...a)=>execute('docker',a);
const dbsql=(sql)=>docker('exec',DB_CONTAINER,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-Atc',sql);
const portBusy=(port)=>new Promise(resolve=>{const sock=net.connect({host:'127.0.0.1',port});sock.once('connect',()=>{sock.destroy();resolve(true)});sock.once('error',()=>{sock.destroy();resolve(false)});setTimeout(()=>{sock.destroy();resolve(false)},1200)});
async function until(fn,{timeout=30000,interval=400,label='condition'}={}){const end=Date.now()+timeout;while(Date.now()<end){try{if(await fn())return true}catch{}await pause(interval)}throw Error(`${label} did not become ready`)}
function record(id,name,status,observation){RESULTS.push({id,name,status,observation:String(observation||'')});console.log(`${status.padEnd(7)} ${id} ${name}${observation?' — '+observation:''}`)}
async function test(id,name,fn){try{record(id,name,'PASS',await fn())}catch(e){record(id,name,'FAIL',e.message)}}
const blocked=(id,name,why)=>record(id,name,'BLOCKED',why);
function token(){const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'}),now=Math.floor(Date.now()/1000);const p=b({sub:STAFF,role:'RECEPTIONIST',iss:'forever-hotel-auth',iat:now,exp:now+3600});return `${h}.${p}.${crypto.createHmac('sha256',JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`}
async function http(method,url,jwt,body){const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),9000);try{const r=await fetch(url,{method,headers:{'content-type':'application/json',...(jwt?{authorization:`Bearer ${jwt}`}:{})},body:body?JSON.stringify(body):undefined,signal:ctrl.signal});let b;try{b=await r.json()}catch{b={}}return {status:r.status,body:b}}finally{clearTimeout(t)}}
const sqlFile=(file)=>{assert(fs.existsSync(file),'Schema file not found: '+file);docker('cp',file,`${DB_CONTAINER}:/tmp/ddp203-phaseb-schema.sql`);docker('exec',DB_CONTAINER,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-f','/tmp/ddp203-phaseb-schema.sql')};
function processForNode(script,cwd,env,key){const p=cp.spawn(process.execPath,[script],{cwd,env,stdio:['ignore','pipe','pipe']});for(const st of [p.stdout,p.stderr])st.on('data',buf=>{if(key==='fds')backendLog=(backendLog+String(buf)).slice(-16000);else wkmsLog=(wkmsLog+String(buf)).slice(-16000)});return p}
async function setup(){
  assert(fs.existsSync(path.join(BACK,'node_modules','socket.io-client')),'FDS backend node_modules required');
  assert(execute('git',['branch','--show-current'])===BRANCH,`Switch to ${BRANCH}`);
  for(const p of [FDS_PORT,WKMS_PORT])assert(!(await portBusy(p)),`Port ${p} is already in use: refusing to contact it`);
  const p1=docker('port',DB_CONTAINER,'5432/tcp');const p2=docker('port',RABBIT_CONTAINER,'5672/tcp');
  assert(p1.includes('127.0.0.1:55434')&&p2.includes('127.0.0.1:5673'),'Unexpected container mapping. Refusing to access unknown infrastructure.');
  assert(dbsql('SELECT current_database()')===DB,'Disposable database name mismatch');
  assert(dbsql("SELECT COUNT(*) FROM bookings WHERE booking_id::text LIKE 'dd019500-%'")==='6','DDP-195 fixture records missing');
  assert(dbsql(`SELECT status::text FROM bookings WHERE booking_id='${BOOKING}'`)==='CONFIRMED',`Required synthetic booking ${BOOKING} already changed`);
  assert(dbsql(`SELECT status::text FROM rooms WHERE room_number='${ROOM}'`)==='VACANT',`Required synthetic room ${ROOM} already changed`);
  assert(dbsql("SELECT (to_regclass('public.wkms_tasks') IS NULL AND to_regclass('public.wkms_event_outbox') IS NULL)::text")==='true','Existing WKMS tables detected; avoid rerunning/mutating previous evidence');
  console.log('PASS: Isolated Docker container ports, fixture IDs, and pristine WKMS schema checked.');
  // Install fresh, reviewed WKMS develop in disposable TEMP clone; do not touch existing WKMS working directory.
  wdir=fs.mkdtempSync(path.join(os.tmpdir(),'fds-ddp203-wkms-'));wb=path.join(wdir,'backend');
  console.log('Cloning WKMS develop into a separate temporary test directory...');
  execute('git',['clone','--depth','1','--branch','develop','https://github.com/forever-hotel/worker-management.git',wdir],{cwd:ROOT});
  const wkmsSha=execute('git',['rev-parse','HEAD'],{cwd:wdir});
  assert(wkmsSha==='3f6cf798873979974261fa5429d468dbd24f1d5c',`WKMS develop moved since inspection: ${wkmsSha}. Review the updated code before executing.`);
  const pkg=JSON.parse(fs.readFileSync(path.join(wb,'package.json'),'utf8'));
  assert(pkg.scripts.build==='nest build','Unexpected WKMS build script. Inspect before running.');
  assert(fs.existsSync(path.join(wb,'package-lock.json')),'WKMS package-lock.json missing');
  console.log('Installing WKMS locked packages with lifecycle scripts disabled...');
  const npm=process.platform==='win32'?'cmd.exe':'npm';const prefix=process.platform==='win32'?['/d','/c','npm']:[];
  execute(npm,[...prefix,'ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:wb,timeout:900000});
  console.log('Building WKMS isolated clone...');
  execute(npm,[...prefix,'run','build'],{cwd:wb,timeout:420000});
  assert(fs.existsSync(path.join(wb,'dist','main.js')),'WKMS compiled main.js missing');
  console.log('Preparing a WKMS-only schema subset based on the provided SQL schema...');
  sqlFile(path.join(THIS,'phase-b-wkms-schema.sql'));
  // New test-only DB role: avoids knowing/rotating the previous runner's random Postgres password.
  dbsql(`CREATE ROLE ${USER} LOGIN PASSWORD '${PASS}'`);
  dbsql(`GRANT CONNECT ON DATABASE ${DB} TO ${USER}`);
  dbsql(`GRANT USAGE ON SCHEMA public TO ${USER}`);
  dbsql(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${USER}`);
  dbsql(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${USER}`);
  // New Rabbit user on existing disposable broker; previous test credentials remain unchanged.
  docker('exec',RABBIT_CONTAINER,'rabbitmqctl','add_user',USER,PASS);
  docker('exec',RABBIT_CONTAINER,'rabbitmqctl','set_permissions','-p','/',USER,'.*','.*','.*');
  const amqp=require(path.join(BACK,'node_modules','amqplib'));
  rabbit=await amqp.connect(AMQP);channel=await rabbit.createConfirmChannel();
  const pg=require(path.join(BACK,'node_modules','pg'));
  pool=new pg.Pool({host:'127.0.0.1',port:DB_PORT,user:USER,password:PASS,database:DB,ssl:false,max:3});
  await pool.query('SELECT 1');
  const common={...process.env,NODE_ENV:'test',JWT_SECRET,PORT:String(FDS_PORT),RABBITMQ_ENABLED:'true',RABBITMQ_URL:AMQP,RABBITMQ_EXCHANGE:'forever.events'};
  const fdsEnv={...common,DB_HOST:'127.0.0.1',DB_PORT:String(DB_PORT),DB_USERNAME:USER,DB_PASSWORD:PASS,DB_NAME:DB,DB_SSL:'false',DB_SYNCHRONIZE:'false',DB_LOGGING:'false',FDS_AUTH_PROVIDER:'legacy',JWT_ISSUER:'forever-hotel-auth',WKMS_INTEGRATION_ENABLED:'false',FDS_ALLOWED_ORIGINS:'http://localhost:3102,http://127.0.0.1:3102'};
  delete fdsEnv.DATABASE_URL;
  const wkmsEnv={...process.env,PORT:String(WKMS_PORT),DATABASE_URL:`postgresql://${USER}:${PASS}@127.0.0.1:${DB_PORT}/${DB}`,JWT_SECRET,RABBITMQ_ENABLED:'true',RABBITMQ_URL:AMQP,RABBITMQ_EXCHANGE:'forever.events'};
  console.log('Starting actual FDS and actual WKMS NestJS backends...');
  const fdsNest=path.join(BACK,'node_modules','@nestjs','cli','bin','nest.js');
  backendProc=cp.spawn(process.execPath,[fdsNest,'start'],{cwd:BACK,env:fdsEnv,stdio:['ignore','pipe','pipe']});
  for(const st of [backendProc.stdout,backendProc.stderr])st.on('data',b=>{backendLog=(backendLog+String(b)).slice(-16000)});
  wkmsProc=processForNode(path.join(wb,'dist','main.js'),wb,wkmsEnv,'wkms');
  await until(async()=>{if(backendProc.exitCode!==null)throw Error(backendLog.slice(-1200));const a=await http('GET',`http://127.0.0.1:${FDS_PORT}/health/ready`);return a.status===200&&a.body?.database==='up'}, {timeout:90000,label:'FDS backend; '+backendLog.slice(-1000)});
  await until(async()=>{if(wkmsProc.exitCode!==null)throw Error(wkmsLog.slice(-1200));const a=await http('GET',`http://127.0.0.1:${WKMS_PORT}/health/ready`);return a.status===200},{timeout:90000,label:'WKMS backend; '+wkmsLog.slice(-1000)});
  await until(async()=>wkmsLog.includes('Checkout consumer connected and subscribed'),{timeout:40000,label:'WKMS real checkout consumer; '+wkmsLog.slice(-1200)});
  const {io}=require(path.join(BACK,'node_modules','socket.io-client'));
  socket=io(`${BASE}/realtime`,{autoConnect:false,transports:['websocket'],reconnection:false,auth:{token:token()},timeout:8000});
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>{clean();reject(Error('FDS socket not ready'))},12000);const ready=()=>{clean();resolve()};const bad=e=>{clean();reject(Error('Socket rejected '+e.message))};const clean=()=>{clearTimeout(t);socket.off('realtime.ready',ready);socket.off('connect_error',bad)};socket.once('realtime.ready',ready);socket.once('connect_error',bad);socket.connect()});
  console.log('PASS: Both real applications running; WKMS consumer and FDS Socket.IO authenticated.');
}
async function checks(){
  let generatedTaskId;
  await test('W02','FDS checkout is consumed and persisted by real WKMS',async()=>{
    const jwt=token();
    let x=await http('POST',`${BASE}/check-in`,jwt,{bookingReference:BOOKING,verification:{documentType:'PASSPORT',verificationMethod:'PHYSICAL_DOCUMENT',verifiedBy:STAFF}});
    assert([200,201].includes(x.status),'FDS check-in failed: '+JSON.stringify(x).slice(0,320));
    x=await http('POST',`${BASE}/check-outs`,jwt,{bookingReference:BOOKING,performedBy:STAFF,paymentMethod:'CASH'});
    assert([200,201].includes(x.status),'FDS checkout failed: '+JSON.stringify(x).slice(0,320));
    await until(async()=>{const q=await pool.query("SELECT task_id,source,category,status FROM wkms_tasks WHERE booking_id=$1 AND source='CHECKOUT_TRIGGER'",[BOOKING]);if(q.rows.length!==1)return false;generatedTaskId=q.rows[0].task_id;return q.rows[0].category==='ROOM_CLEANING'&&q.rows[0].status==='UNASSIGNED'},{timeout:25000,label:'WKMS checkout cleaning task in database'});
    const bk=(await pool.query('SELECT status,room_number FROM bookings WHERE booking_id=$1',[BOOKING])).rows[0];
    assert(bk.status==='CHECKED_OUT'&&bk.room_number===ROOM,'Booking not checked out');
    return `FDS HTTP checkout -> real WKMS RabbitMQ consumer -> wkms_tasks task ${generatedTaskId}`;
  });
  await test('W02D','Redelivered checkout event creates no duplicate WKMS task',async()=>{
    assert(generatedTaskId,'W02 must pass first');
    const now=new Date().toISOString();const evt={eventId:`checkout:${BOOKING}`,eventType:'checkout.completed',eventVersion:1,occurredAt:now,source:'front-desk',data:{bookingReference:BOOKING,roomNumber:ROOM,taskCategory:'ROOM_CLEANING',priority:'HIGH',sourceType:'CHECKOUT_TRIGGER'}};
    channel.publish('forever.events','fds.checkout.completed.v1',Buffer.from(JSON.stringify(evt)),{persistent:true,messageId:evt.eventId,contentType:'application/json'});await channel.waitForConfirms();
    await until(async()=>{const q=await channel.checkQueue('wkms.checkout-completed.v1');return q.messageCount===0},{timeout:15000,label:'WKMS duplicate event consumed and acknowledged'});
    const a=await pool.query("SELECT count(*)::int AS n FROM wkms_tasks WHERE booking_id=$1 AND source='CHECKOUT_TRIGGER'",[BOOKING]);assert(a.rows[0].n===1,'Duplicate task created');return 'Exactly one persisted checkout-triggered task';
  });
  await test('W03','Real WKMS escalation and outbox reaches FDS realtime and REST',async()=>{
    assert(generatedTaskId,'W02 must pass first');
    let evt;
    const received=new Promise(resolve=>{socket.on('task.escalated',m=>{if(m.data?.taskId===generatedTaskId){evt=m;resolve()}})});
    await pool.query("UPDATE wkms_tasks SET submitted_at=NOW()-INTERVAL '18 minutes' WHERE task_id=$1 AND status='UNASSIGNED'",[generatedTaskId]);
    const driver=path.join(wb,'phase-b-trigger.cjs');fs.copyFileSync(path.join(THIS,'phase-b-trigger.cjs'),driver);
    const env={...process.env,PORT:String(WKMS_PORT+1),DATABASE_URL:`postgresql://${USER}:${PASS}@127.0.0.1:${DB_PORT}/${DB}`,JWT_SECRET,RABBITMQ_ENABLED:'true',RABBITMQ_URL:AMQP,RABBITMQ_EXCHANGE:'forever.events'};
    execute(process.execPath,[driver],{cwd:wb,env,timeout:110000});
    await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(Error('WKMS escalation not delivered to FDS Socket.IO')),20000))]);
    assert(evt.eventType==='task.escalated'&&evt.source==='worker-management','Wrong live WKMS escalation event');
    const out=(await pool.query('SELECT status,event_type,routing_key FROM wkms_event_outbox WHERE task_id=$1',[generatedTaskId])).rows;
    assert(out.length===1&&out[0].status==='PUBLISHED'&&out[0].routing_key==='wkms.task.escalated.v1','WKMS outbox not published');
    const row=(await pool.query('SELECT status FROM wkms_tasks WHERE task_id=$1',[generatedTaskId])).rows[0];assert(row.status==='ESCALATED','WKMS task status not ESCALATED');
    const api=await http('GET',`${BASE}/realtime/escalations`,token());assert(api.status===200&&api.body.some(x=>x.data?.taskId===generatedTaskId),'FDS REST fallback lacks real WKMS escalation');
    return 'Actual WKMS TaskEscalationService + outbox -> RabbitMQ -> FDS Socket.IO + REST';
  });
  blocked('W04','WKMS service-request REST and manual assignment','WKMS develop has no /wkms/internal/tasks or /wkms/internal/workers/available controllers; requires separately implemented internal contract');
  blocked('R06','Actual receptionist browser UX','Requires Next.js browser session and manual visual/interactivity evidence');
  blocked('M09','Controlled broker restart and recovery','Separate failure-injection run required; not performed here');
}
function evidence(){const dir=path.join(ROOT,'evidence','fds-messaging-realtime');fs.mkdirSync(dir,{recursive:true});const safe=s=>String(s).replaceAll(PASS,'[REDACTED]').replaceAll(JWT_SECRET,'[REDACTED]');const csv=[['test_id','scenario','status','observed_result'],...RESULTS.map(x=>[x.id,x.name,x.status,safe(x.observation)])].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n')+'\r\n';fs.writeFileSync(path.join(dir,'phase-b-execution-register.csv'),csv);const counts=s=>RESULTS.filter(x=>x.status===s).length;const md=['# DDP-203 Phase B — Actual FDS/WKMS Integration','',`Executed: ${RUN_AT}`,'Environment: local disposable Plan 03 PostgreSQL 55434 and RabbitMQ 5673; FDS 4303; WKMS 4403, cloned WKMS develop.','The WKMS schema here is a verified integration-test subset, not a WKMS production migration.','Original FDS and WKMS .env files and Neon untouched.','','**Results: '+`${counts('PASS')} PASS, ${counts('FAIL')} FAIL, ${counts('BLOCKED')} BLOCKED`+'**','',...RESULTS.map(x=>`- **${x.status}** ${x.id}: ${x.name} — ${safe(x.observation)}`),'','## Constraints','- W02 requires WKMS consuming the live checkout message and persisting exactly one room-cleaning task.','- W03 invokes actual WKMS service and outbox code through a one-shot Nest application context; this does not claim proof of the 5-minute scheduler timing.','- No claims of real browser UX, missing WKMS internal REST API routes, broker restart or distributed exactly-once delivery.','- Disposable PostgreSQL and RabbitMQ retained for review; do not run Plan 03 initial seed package again against them.','','## Safety','- Random test-only DB and Rabbit credentials were generated and not written to evidence.','- Original WKMS repository remains untouched; disposable WKMS clone in OS temporary folder.'].join('\n')+'\n';fs.writeFileSync(path.join(dir,'phase-b-verification.md'),md);return dir}
async function stop(p){if(!p)return;try{if(process.platform==='win32')cp.spawnSync('taskkill',['/PID',String(p.pid),'/T','/F'],{stdio:'ignore',timeout:17000});else p.kill('SIGTERM')}catch{}}
(async()=>{let ok=false;try{await setup();await checks();ok=RESULTS.every(x=>x.status!=='FAIL')}catch(e){const detail=String(e.stack||e).slice(-1500).replaceAll(PASS,'[REDACTED]').replaceAll(JWT_SECRET,'[REDACTED]');console.error('FATAL:',detail);record('SETUP','Phase B setup and startup','FAIL',detail.slice(-900))}finally{try{console.log('Evidence:',evidence())}catch(e){console.error('Evidence write error:',e.message);ok=false}try{socket?.disconnect()}catch{}try{await channel?.close()}catch{}try{await rabbit?.close()}catch{}try{await pool?.end()}catch{}await stop(backendProc);await stop(wkmsProc);const c=s=>RESULTS.filter(x=>x.status===s).length;console.log(`Phase B: ${c('PASS')} PASS, ${c('FAIL')} FAIL, ${c('BLOCKED')} BLOCKED`);console.log('Do not remove the named Plan 03 Docker containers before reviewing both evidence sets.');process.exitCode=ok?0:1}})();
