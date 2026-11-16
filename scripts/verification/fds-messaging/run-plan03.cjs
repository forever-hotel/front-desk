'use strict';
/**
 * DDP-203 / Issue #91 — real local RabbitMQ + FDS Socket.IO acceptance.
 * Only disposable Docker resources; does not modify backend/.env or use Neon.
 * WKMS-format events are injected by the test harness, not by a running WKMS.
 * Run with Node 24+ from the front-desk repository root.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const net = require('node:net');

const ROOT = process.cwd();
const BACK = path.join(ROOT, 'backend');
const CONTAINER_DB = 'fds-ddp203-postgres';
const CONTAINER_RABBIT = 'fds-ddp203-rabbitmq';
const DB = 'front_desk_test';
const DB_PORT = 55434;
const AMQP_PORT = 5673;
const MGMT_PORT = 15673;
const HTTP_PORT = 4302;
const URL = `http://127.0.0.1:${HTTP_PORT}`;
const BRANCH = 'feature/91-fds-messaging-realtime-verification';
const RECEPTIONIST = '66666666-6666-4666-8666-666666666666';
const MANAGER = '77777777-7777-4777-8777-777777777777';
const CHECKOUT_BOOKING = 'dd019500-0000-4000-8000-000000000102';
const FIXTURE_ROOM = 'R1954';
const RABBIT_USER = 'fdsddp203';
const DB_PASSWORD = crypto.randomBytes(24).toString('hex');
const RABBIT_PASSWORD = crypto.randomBytes(24).toString('hex');
const JWT_SECRET = crypto.randomBytes(48).toString('hex');
const AMQP_URL = `amqp://${RABBIT_USER}:${RABBIT_PASSWORD}@127.0.0.1:${AMQP_PORT}`;
const date = new Date();
const results = [];
const limits = { commands: 360000, api: 10000 };
let app;
let appLog = '';
let rabbitConn;
let rabbitChannel;
let pool;
let clerkSocket;
let managerSocket;
let createdDB = false;
let createdRabbit = false;
const roomEvents = [];
const escalationEvents = [];
const managerEscalationEvents = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(x, message) { if (!x) throw new Error(message); }
function run(command, args, options={}) {
  const p = cp.spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout:limits.commands,maxBuffer:16*1024*1024,...options});
  if (p.error || p.status !== 0) throw new Error(`${command}: ${p.error?.message || p.stderr?.slice(-1200) || p.stdout?.slice(-1200)}`);
  return (p.stdout || '').trim();
}
const docker = (...a) => run('docker',a);
const psql = sql => docker('exec',CONTAINER_DB,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-Atc',sql);
function sqlFile(file, name) {
  assert(fs.existsSync(file),`Missing SQL file: ${file}`);
  const remote = `/tmp/${name || path.basename(file)}`;
  docker('cp',file,`${CONTAINER_DB}:${remote}`);
  docker('exec',CONTAINER_DB,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-f',remote);
}
async function portBusy(port) {
  return new Promise(resolve=>{
    const s=net.connect({host:'127.0.0.1',port});
    s.once('connect',()=>{s.destroy();resolve(true)});
    s.once('error',()=>{s.destroy();resolve(false)});
    setTimeout(()=>{s.destroy();resolve(false)},1000);
  });
}
async function until(predicate,{attempts=80,interval=500,label='condition'}={}){
  for(let i=0;i<attempts;i++){
    try{if(await predicate())return;}catch{}
    await pause(interval);
  }
  throw new Error(`${label} did not become ready`);
}
function record(id,title,kind,note){results.push({id,title,status:kind,note:String(note||'').slice(0,800)});console.log(`${kind.padEnd(7)} ${id} ${title}${note?' — '+note:''}`)}
async function test(id,title,fn) {
  try{record(id,title,'PASS',await fn());}catch(e){record(id,title,'FAIL',e.message||e)}
}
function blocked(id,title,why){record(id,title,'BLOCKED',why)}
function jwt(secret, role, sub) {
  const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const head=b({typ:'JWT',alg:'HS256'});
  const now=Math.floor(Date.now()/1000);
  const payload=b({sub,role,iss:'forever-hotel-auth',iat:now,exp:now+3600});
  return `${head}.${payload}.${crypto.createHmac('sha256',secret).update(`${head}.${payload}`).digest('base64url')}`;
}
async function api(method,endpoint,token,body){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),limits.api);
  try{
    const headers={Accept:'application/json','Content-Type':'application/json'};
    if(token) headers.Authorization=`Bearer ${token}`;
    const res=await fetch(URL+endpoint,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const raw=await res.text();let data;try{data=JSON.parse(raw)}catch{data={raw:raw.slice(0,400)}};
    return {status:res.status,data};
  }finally{clearTimeout(timer)}
}
async function expectApi(method,endpoint,token,body,allowed=[200]){
  const r=await api(method,endpoint,token,body);
  assert(allowed.includes(r.status),`${method} ${endpoint}: HTTP ${r.status}, expected ${allowed.join('/')} (${JSON.stringify(r.data).slice(0,220)})`);
  return r.data;
}
async function db(sql,params=[]){return (await pool.query(sql,params)).rows;}
async function first(sql,params=[]){const a=await db(sql,params);assert(a.length>0,'Required DB row absent');return a[0]}
async function mgmt(endpoint){
  const c=new AbortController();const timeout=setTimeout(()=>c.abort(),limits.api);
  try{
    const a=Buffer.from(`${RABBIT_USER}:${RABBIT_PASSWORD}`).toString('base64');
    const r=await fetch(`http://127.0.0.1:${MGMT_PORT}/api/${endpoint}`,{headers:{Authorization:`Basic ${a}`},signal:c.signal});
    assert(r.status===200,`RabbitMQ Management API ${endpoint}: ${r.status}`);
    return await r.json();
  }finally{clearTimeout(timeout)}
}
async function getMessage(queue,timeout=10000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){const msg=await rabbitChannel.get(queue,{noAck:false});if(msg)return msg;await pause(200)}
  throw new Error(`No RabbitMQ message received from ${queue}`);
}
function publishConfirmed(routingKey,payload,messageId,raw=false){
  const buffer=Buffer.from(raw ? String(payload) : JSON.stringify(payload),'utf8');
  assert(rabbitChannel.publish('forever.events',routingKey,buffer,{persistent:true,messageId,contentType:'application/json'} )!==undefined,'Rabbit publish call unsuccessful');
  return rabbitChannel.waitForConfirms();
}
function makeSocket(io,token,eventList){
  const socket=io(`${URL}/realtime`,{autoConnect:false,transports:['websocket'],reconnection:false,timeout:8000,auth:{token}});
  socket.on('room.status.updated',event=>roomEvents.push(event));
  socket.on('task.escalated',event=>eventList.push(event));
  return socket;
}
async function socketReady(socket){
  return new Promise((resolve,reject)=>{
    const t=setTimeout(()=>{clear();reject(new Error('No authenticated realtime.ready event'))},11000);
    const ready=e=>{clear();resolve(e)};
    const failed=e=>{clear();reject(new Error(`Socket authentication/connection: ${String(e.message||e)}`))};
    const clear=()=>{clearTimeout(t);socket.off('realtime.ready',ready);socket.off('connect_error',failed)};
    socket.once('realtime.ready',ready);socket.once('connect_error',failed);socket.connect();
  });
}
async function rejectSocket(io,token){
  const socket=io(`${URL}/realtime`,{autoConnect:false,transports:['websocket'],reconnection:false,timeout:7000,auth:{token}});
  try{
    return await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>{clean();reject(new Error('No connect_error received'))},9000);
      const bad=e=>{clean();resolve(String(e.message||e))};
      const good=()=>{clean();reject(new Error('Unauthorized socket connected'))};
      const clean=()=>{clearTimeout(t);socket.off('connect_error',bad);socket.off('connect',good)};
      socket.once('connect_error',bad);socket.once('connect',good);socket.connect();
    });
  }finally{socket.disconnect()}
}
async function prepare(){
  assert(fs.existsSync(path.join(BACK,'package.json')),'Must execute from the front-desk repository root');
  for(const f of ['amqplib','pg','socket.io-client'])assert(fs.existsSync(path.join(BACK,'node_modules',f)),'Install backend dependencies first: missing '+f);
  assert(fs.existsSync(path.join(BACK,'test/database/fixtures/ddp195/01_seed.sql')),'Missing Plan 01 fixture script; update from develop');
  const current=run('git',['branch','--show-current']);assert(current===BRANCH,`Wrong Git branch: ${current}; expected ${BRANCH}`);
  for(const port of [DB_PORT,AMQP_PORT,MGMT_PORT,HTTP_PORT])assert(!(await portBusy(port)),`Local port ${port} is busy; refusing to contact unknown service`);
  for(const name of [CONTAINER_DB,CONTAINER_RABBIT]){
    const r=cp.spawnSync('docker',['container','inspect',name],{encoding:'utf8'});
    assert(r.status!==0,`Container ${name} already exists. Do not overwrite; inspect/remove it deliberately before a fresh run.`);
  }
  console.log('Starting fresh disposable PostgreSQL on localhost:55434...');
  docker('run','-d','--name',CONTAINER_DB,'--rm','-e','POSTGRES_USER=postgres','-e',`POSTGRES_PASSWORD=${DB_PASSWORD}`,'-e',`POSTGRES_DB=${DB}`,'-p','127.0.0.1:55434:5432','postgres:16');createdDB=true;
  console.log('Starting fresh isolated RabbitMQ broker on localhost:5673 / 15673...');
  docker('run','-d','--name',CONTAINER_RABBIT,'--rm','-e',`RABBITMQ_DEFAULT_USER=${RABBIT_USER}`,'-e',`RABBITMQ_DEFAULT_PASS=${RABBIT_PASSWORD}`,'-p','127.0.0.1:5673:5672','-p','127.0.0.1:15673:15672','rabbitmq:4-management');createdRabbit=true;
  await until(()=>{const p=cp.spawnSync('docker',['exec',CONTAINER_DB,'pg_isready','-U','postgres','-d',DB],{encoding:'utf8'});return p.status===0},{attempts:140,interval:500,label:'PostgreSQL'});
  await until(()=>psql('SELECT current_database()')===DB,{attempts:35,interval:500,label:'PostgreSQL ready after initialization restart'});
  assert(docker('port',CONTAINER_DB,'5432/tcp').includes('127.0.0.1:55434'),'DB is not bound locally');
  assert(docker('port',CONTAINER_RABBIT,'5672/tcp').includes('127.0.0.1:5673'),'RabbitMQ is not bound locally');
  const amqp=require(path.join(BACK,'node_modules','amqplib'));
  await until(async()=>{const c=await amqp.connect(AMQP_URL);await c.close();return true},{attempts:180,interval:700,label:'RabbitMQ AMQP'});
  await until(async()=>{const x=await mgmt('overview');return !!x.rabbitmq_version},{attempts:120,interval:700,label:'RabbitMQ Management API'});
  console.log('Applying shared schema, local migrations, and deterministic fixtures...');
  sqlFile(path.join(BACK,'test/database/shared-schema.sql'));
  const env={...process.env,NODE_ENV:'test',DB_HOST:'127.0.0.1',DB_PORT:String(DB_PORT),DB_USERNAME:'postgres',DB_PASSWORD,DB_NAME:DB,DB_SSL:'false',DB_SYNCHRONIZE:'false',DB_LOGGING:'false',PORT:String(HTTP_PORT),FDS_AUTH_PROVIDER:'legacy',JWT_SECRET,JWT_ISSUER:'forever-hotel-auth',RABBITMQ_ENABLED:'true',RABBITMQ_URL:AMQP_URL,RABBITMQ_EXCHANGE:'forever.events',WKMS_INTEGRATION_ENABLED:'false',FDS_ALLOWED_ORIGINS:'http://127.0.0.1:3102,http://localhost:3102'};
  delete env.DATABASE_URL;
  run(process.platform==='win32'?'cmd.exe':'npm',process.platform==='win32'?['/d','/c','npm','run','migration:run']:['run','migration:run'],{cwd:BACK,env});
  sqlFile(path.join(BACK,'test/database/seed.sql'));
  const fixture=fs.readFileSync(path.join(BACK,'test/database/fixtures/ddp195/01_seed.sql'),'utf8');
  const guard="current_database() <> 'forever'";
  assert(fixture.includes(guard),'Fixture database safety guard has changed; refusing to alter SQL');
  const temp=path.join(os.tmpdir(),`fds-ddp203-seed-${process.pid}.sql`);
  fs.writeFileSync(temp,fixture.replace(guard,`current_database() <> '${DB}'`),'utf8');
  try{sqlFile(temp,'ddp203-seed.sql')}finally{try{fs.unlinkSync(temp)}catch{}}
  assert(psql("SELECT COUNT(*) FROM bookings WHERE booking_id::text LIKE 'dd019500-%'")==='6','Required synthetic bookings missing');
  const {Pool}=require(path.join(BACK,'node_modules','pg'));
  pool=new Pool({host:'127.0.0.1',port:DB_PORT,user:'postgres',password:DB_PASSWORD,database:DB,ssl:false,max:2});
  rabbitConn=await amqp.connect(AMQP_URL);
  rabbitChannel=await rabbitConn.createConfirmChannel();
  console.log('Starting isolated NestJS backend with RabbitMQ ENABLED...');
  const nest=path.join(BACK,'node_modules','@nestjs','cli','bin','nest.js');assert(fs.existsSync(nest),'Nest CLI missing');
  app=cp.spawn(process.execPath,[nest,'start'],{cwd:BACK,env,stdio:['ignore','pipe','pipe']});
  for(const s of [app.stdout,app.stderr])s.on('data',buf=>{appLog=(appLog+String(buf)).slice(-20000)});
  await until(async()=>{if(app.exitCode!==null)throw new Error('Backend exited');const res=await api('GET','/health/ready');return res.status===200&&res.data?.database==='up'},{attempts:190,interval:700,label:'NestJS backend (logs '+appLog.slice(-1000)+')'});
  console.log('Isolated backend is ready. Beginning real RabbitMQ / Socket.IO assertions...');
  return {io:require(path.join(BACK,'node_modules','socket.io-client')).io,clerk:jwt(JWT_SECRET,'RECEPTIONIST',RECEPTIONIST),manager:jwt(JWT_SECRET,'MANAGER',MANAGER)};
}
function evidence(){
  const dir=path.join(ROOT,'evidence','fds-messaging-realtime');fs.mkdirSync(dir,{recursive:true});
  const row=[['test_id','scenario','status','observed_result'],...results.map(x=>[x.id,x.title,x.status,x.note])];
  const csv=row.map(a=>a.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n')+'\r\n';
  fs.writeFileSync(path.join(dir,'execution-register.csv'),csv,'utf8');
  const count=type=>results.filter(x=>x.status===type).length;
  const doc=[
    '# DDP-203 — Plan 03: Isolated RabbitMQ and Realtime Acceptance',
    '',`Executed: ${date.toISOString()}`,
    'Branch: feature/91-fds-messaging-realtime-verification',
    'Environment: disposable Docker PostgreSQL 16 (127.0.0.1:55434), RabbitMQ 4 management (127.0.0.1:5673 / 15673), FDS NestJS backend (127.0.0.1:4302).',
    'No shared/Neon database, production broker, or original .env was modified.',
    'The task escalation originated from the local test publisher, NOT a running WKMS service.',
    `\n**Result: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('BLOCKED')} BLOCKED.**`,
    ...results.map(x=>`- **${x.status}** ${x.id}: ${x.title}${x.note?' — '+x.note:''}`),
    '',
    '## Coverage boundaries and remaining dependencies',
    '- RabbitMQ and Socket.IO PASS results apply to the isolated FDS test environment only.',
    '- A temporary observer queue receives checkout events; this does not prove WKMS received or persisted room-cleaning tasks.',
    '- FDS consumes a synthetically published, WKMS-compatible escalation; this does not prove WKMS actually emitted it.',
    '- Real WKMS REST service requests/assignments and database persistence require a running isolated WKMS backend.',
    '- Physical receptionist browser workflow, multi-client UX, and full broker-down/restart replay require separate tests.',
    '- Broker-disconnect recovery, reconnect after process restart, and event-loss guarantees are not established by queue declaration alone.',
    '- Neon migration-history discrepancy from DDP-195 remains an independent open finding.',
    '- Review existing GitHub Dependabot security advisory separately.',
    '',
    '## Safety and cleanup',
    `- Local disposable containers retained: ${CONTAINER_DB}, ${CONTAINER_RABBIT}.`,
    '- Evidence excludes broker/database passwords and JWT secrets.',
    '- Clean up only after review: docker rm -f fds-ddp203-postgres fds-ddp203-rabbitmq',
  ].join('\n')+'\n';
  fs.writeFileSync(path.join(dir,'verification.md'),doc,'utf8');return dir;
}
async function acceptance({io,clerk,manager}){
  await test('M01','RabbitMQ exchange, durable queue and bindings',async()=>{
    const exchange=await mgmt('exchanges/%2F/forever.events');
    assert(exchange.type==='topic'&&exchange.durable===true,'Invalid exchange durability/type');
    for(const name of ['fds.task-escalation.v1','fds.task-escalation.retry.v1','fds.task-escalation.dlq.v1']){
      const q=await mgmt('queues/%2F/'+encodeURIComponent(name));
      assert(q.durable===true,`${name} is not durable`);
    }
    const bindings=await mgmt('bindings/%2F/e/forever.events/q/fds.task-escalation.v1');
    assert(bindings.some(x=>x.routing_key==='wkms.task.escalated.v1'),'Task escalation queue routing key missing');
    return 'topic exchange, 3 durable queues, wkms.task.escalated.v1 binding';
  });
  await test('M02','RabbitMQ retry and DLQ routing configuration',async()=>{
    const main=await mgmt('queues/%2F/fds.task-escalation.v1');
    const retry=await mgmt('queues/%2F/fds.task-escalation.retry.v1');
    const dlq=await mgmt('queues/%2F/fds.task-escalation.dlq.v1');
    assert(main.arguments?.['x-dead-letter-exchange']==='forever.events','Main queue missing DLX');
    assert(main.arguments?.['x-dead-letter-routing-key']==='fds.task-escalation.dlq.v1','Main DLQ routing incorrect');
    assert(retry.arguments?.['x-message-ttl']>0,'Retry queue missing TTL');
    assert(retry.arguments?.['x-dead-letter-routing-key']==='wkms.task.escalated.v1','Retry route incorrect');
    assert(dlq.durable===true,'DLQ not durable');
    return `retry TTL ${retry.arguments['x-message-ttl']}ms; DLQ durable`;
  });
  await test('R01','Realtime contract authenticates and advertises fallback',async()=>{
    await expectApi('GET','/realtime/contract',undefined,undefined,[401]);
    const x=await expectApi('GET','/realtime/contract',clerk,undefined,[200]);
    assert(x.namespace==='/realtime'&&x.version===1,'Incorrect namespace/version');
    assert(x.events.taskEscalated==='task.escalated'&&x.events.roomStatusUpdated==='room.status.updated','Incorrect event names');
    assert(x.fallback?.roomStatus?.path==='/rooms/status'&&x.fallback?.escalations?.path==='/realtime/escalations','Fallback endpoints incorrect');
    await expectApi('GET','/realtime/contract',manager,undefined,[200]);
    return 'JWT-protected /realtime v1, authenticated manager allowed';
  });
  await test('R02','Socket.IO rejects unauthorized connections',async()=>{
    const blank=await rejectSocket(io,undefined);
    const invalid=await rejectSocket(io,'invalid.jwt.token');
    assert(blank&&invalid,'Missing rejection signals');
    return 'missing and invalid JWT rejected by /realtime namespace';
  });
  await test('R03','Receptionist and manager receive realtime.ready',async()=>{
    clerkSocket=makeSocket(io,clerk,escalationEvents);
    managerSocket=makeSocket(io,manager,managerEscalationEvents);
    const one=await socketReady(clerkSocket);
    const two=await socketReady(managerSocket);
    assert(one.eventType==='realtime.ready'&&one.contractVersion===1,'Receptionist ready wrong');
    assert(two.eventType==='realtime.ready'&&two.contractVersion===1,'Manager ready wrong');
    return 'both authenticated clients connected using WebSocket';
  });
  await test('R04','Room-status mutation produces real Socket.IO event',async()=>{
    assert(clerkSocket?.connected,'Receptionist Socket.IO not connected');
    await expectApi('PATCH',`/rooms/${FIXTURE_ROOM}/status`,clerk,{targetStatus:'VACANT',performedBy:RECEPTIONIST,notes:'DDP203 isolated maintenance clear'},[200]);
    await until(()=>roomEvents.some(e=>e.data?.roomNumber===FIXTURE_ROOM&&e.data.status==='VACANT'),{attempts:45,interval:200,label:'room.status.updated push'});
    const e=roomEvents.find(x=>x.data?.roomNumber===FIXTURE_ROOM&&x.data.status==='VACANT');
    assert(e.eventType==='room.status.updated'&&e.contractVersion===1&&e.data.source==='ROOM_STATUS','Incorrect room event');
    const r=await first('SELECT status::text AS status FROM rooms WHERE room_number=$1',[FIXTURE_ROOM]);
    assert(r.status==='VACANT','Socket event does not match committed database');
    return 'R1954 -> VACANT, database and Socket.IO payload match';
  });
  let taskId;
  await test('M03','Real RabbitMQ task escalation reaches FDS Socket.IO',async()=>{
    assert(clerkSocket?.connected&&managerSocket?.connected,'Realtime clients disconnected');
    taskId=crypto.randomUUID();
    const now=new Date().toISOString();
    const msg={eventId:`escalation:${taskId}`,eventType:'task.escalated',eventVersion:1,occurredAt:now,source:'worker-management',data:{taskId,taskCategory:'ROOM_CLEANING',roomNumber:'R1951',priority:'HIGH',escalatedAt:now}};
    await publishConfirmed('wkms.task.escalated.v1',msg,msg.eventId);
    await until(()=>escalationEvents.some(x=>x.data?.taskId===taskId)&&managerEscalationEvents.some(x=>x.data?.taskId===taskId),{attempts:70,interval:200,label:'FDS task escalation realtime delivery'});
    const list=await expectApi('GET','/realtime/escalations',clerk,undefined,[200]);
    assert(Array.isArray(list)&&list.some(x=>x.data?.taskId===taskId),'Escalation not retrievable from FDS fallback endpoint');
    return 'test-published WKMS-format message consumed; both Socket.IO clients and REST received';
  });
  await test('M04','Duplicate escalation is deduplicated in FDS REST state',async()=>{
    assert(taskId,'Original escalation did not pass');
    const now=new Date().toISOString();
    const same={eventId:`escalation:${taskId}`,eventType:'task.escalated',eventVersion:1,occurredAt:now,source:'worker-management',data:{taskId,taskCategory:'ROOM_CLEANING',roomNumber:'R1951',priority:'HIGH',escalatedAt:now}};
    const beforeCount=escalationEvents.filter(e=>e.data?.taskId===taskId).length;
    await publishConfirmed('wkms.task.escalated.v1',same,same.eventId);
    await until(()=>escalationEvents.filter(e=>e.data?.taskId===taskId).length>beforeCount,{attempts:40,interval:200,label:'second escalation consumption'});
    const list=await expectApi('GET','/realtime/escalations',clerk,undefined,[200]);
    assert(list.filter(e=>e.data?.taskId===taskId).length===1,'Duplicate task appears more than once');
    return 'Map-based FDS REST state has one row per taskId (not a durable inbox)';
  });
  await test('M05','Invalid JSON is rejected into real RabbitMQ DLQ',async()=>{
    const malformed=`{bad-json:${crypto.randomUUID()}`;
    await publishConfirmed('wkms.task.escalated.v1',malformed,'ddp203-malformed',true);
    const msg=await getMessage('fds.task-escalation.dlq.v1',10000);
    const body=msg.content.toString('utf8');rabbitChannel.ack(msg);
    assert(body===malformed,`Dead-lettered payload unexpected: ${body.slice(0,100)}`);
    return 'malformed JSON delivered to DLQ and acknowledged by isolated test probe';
  });
  await test('M06','Invalid task escalation schema dead-letters without state mutation',async()=>{
    const badId=crypto.randomUUID();
    const event={eventId:`escalation:${badId}`,eventType:'task.escalated',eventVersion:999,occurredAt:new Date().toISOString(),source:'worker-management',data:{taskId:'not-valid-uuid',taskCategory:'WRONG',roomNumber:'R1951',priority:'HIGH',escalatedAt:new Date().toISOString()}};
    await publishConfirmed('wkms.task.escalated.v1',event,event.eventId);
    const m=await getMessage('fds.task-escalation.dlq.v1',10000);
    let parsed;try{parsed=JSON.parse(m.content.toString('utf8'))}catch{}
    rabbitChannel.ack(m);
    assert(parsed?.eventId===event.eventId,'Expected invalid event did not reach DLQ');
    const list=await expectApi('GET','/realtime/escalations',clerk,undefined,[200]);
    assert(!list.some(e=>e.eventId===event.eventId),'Invalid event leaked into FDS state');
    return 'invalid schema rejected, DLQ received; no escalation state created';
  });
  await test('M07','Checkout event is delivered by real FDS publisher to RabbitMQ',async()=>{
    const queue=await rabbitChannel.assertQueue('',{exclusive:true,autoDelete:true});
    await rabbitChannel.bindQueue(queue.queue,'forever.events','fds.checkout.completed.v1');
    const status=await first('SELECT status::text AS status,room_number AS room FROM bookings WHERE booking_id=$1',[CHECKOUT_BOOKING]);
    assert(status.status==='CHECKED_IN'&&status.room==='R1952','Checkout fixture not ready');
    await expectApi('POST','/check-outs',clerk,{bookingReference:CHECKOUT_BOOKING,performedBy:RECEPTIONIST,paymentMethod:'CASH'},[200,201]);
    const message=await getMessage(queue.queue,12000);
    const event=JSON.parse(message.content.toString('utf8'));rabbitChannel.ack(message);
    const after=await first('SELECT status::text AS status FROM bookings WHERE booking_id=$1',[CHECKOUT_BOOKING]);
    const room=await first('SELECT status::text AS status FROM rooms WHERE room_number=$1',['R1952']);
    assert(after.status==='CHECKED_OUT'&&room.status==='REQUIRES_CLEANING','Checkout persistence incorrect');
    assert(event.eventType==='checkout.completed'&&event.eventVersion===1,'Wrong checkout event contract');
    assert(event.source==='front-desk'&&event.data.bookingReference===CHECKOUT_BOOKING&&event.data.roomNumber==='R1952','Wrong booking/room in RabbitMQ event');
    assert(event.data.taskCategory==='ROOM_CLEANING'&&event.data.priority==='HIGH','Wrong cleaning trigger');
    assert(event.eventId===`checkout:${CHECKOUT_BOOKING}`&&message.properties.deliveryMode===2,'Event ID or durability incorrect');
    await until(()=>roomEvents.some(x=>x.data?.roomNumber==='R1952'&&x.data?.source==='CHECK_OUT'&&x.data?.status==='REQUIRES_CLEANING'),{attempts:50,interval:200,label:'checkout realtime room event'});
    return 'committed checkout, cleaning room, durable RabbitMQ event, realtime checkout room update';
  });
  await test('M08','Duplicate checkout rejected and no new payment created',async()=>{
    const before=await first('SELECT COUNT(*)::int AS n FROM payments WHERE booking_id=$1',[CHECKOUT_BOOKING]);
    await expectApi('POST','/check-outs',clerk,{bookingReference:CHECKOUT_BOOKING,performedBy:RECEPTIONIST,paymentMethod:'CASH'},[409]);
    const after=await first('SELECT COUNT(*)::int AS n FROM payments WHERE booking_id=$1',[CHECKOUT_BOOKING]);
    assert(before.n===after.n,'Duplicate checkout created payment');
    return 'HTTP 409 and no second payment';
  });
  await test('R05','Socket reconnection and authenticated REST full resync',async()=>{
    assert(clerkSocket,'Receptionist socket not established');
    clerkSocket.disconnect();
    assert(!clerkSocket.connected,'Client did not disconnect');
    const rooms=await expectApi('GET','/rooms/status',clerk,undefined,[200]);
    const escalations=await expectApi('GET','/realtime/escalations',clerk,undefined,[200]);
    assert(Array.isArray(rooms)&&rooms.some(r=>r.roomNumber==='R1952'&&r.status==='REQUIRES_CLEANING'),'Room fallback not reflecting checkout');
    assert(Array.isArray(escalations)&&escalations.some(e=>e.data?.taskId===taskId),'Escalation fallback missing task');
    const ready=await socketReady(clerkSocket);
    assert(ready.eventType==='realtime.ready'&&ready.contractVersion===1,'Socket reconnect did not reauthenticate');
    return 'authenticated manual reconnect succeeds; REST fallback agrees with server state';
  });
  await test('W01','Unavailable WKMS returns controlled response',async()=>{
    await expectApi('GET','/service-requests/available-workers',clerk,undefined,[503]);
    return 'controlled 503 because WKMS integration disabled in isolated FDS test';
  });
  blocked('W02','Actual WKMS consumes checkout event and creates task','requires WKMS running with isolated DB/broker; observer queue is not a WKMS consumer');
  blocked('W03','Actual WKMS publishes escalation','local test injects WKMS-format event; it is not generated by WKMS itself');
  blocked('W04','Live WKMS service request and manual worker assignment','requires isolated WKMS REST deployment and agreed authentication/worker identity');
  blocked('R06','Real frontend browser realtime UX','requires manual browser-based Front Desk testing with valid receptionist session');
  blocked('M09','Broker restart, automatic consumer recovery and delivery replay','requires a dedicated controlled failure-injection test; declaration of retry/DLQ does not prove automatic recovery');
}
async function cleanup(){
  try{clerkSocket?.disconnect()}catch{}
  try{managerSocket?.disconnect()}catch{}
  try{if(rabbitChannel)await rabbitChannel.close()}catch{}
  try{if(rabbitConn)await rabbitConn.close()}catch{}
  try{if(pool)await pool.end()}catch{}
  try{if(app){if(process.platform==='win32')cp.spawnSync('taskkill',['/PID',String(app.pid),'/T','/F'],{stdio:'ignore',timeout:16000});else app.kill('SIGTERM')}}catch{}
}
(async()=>{
  let code=1;
  try{const cfg=await prepare();await acceptance(cfg);code=results.some(r=>r.status==='FAIL')?1:0}
  catch(e){const message=String(e.stack||e).slice(-2500).replaceAll(DB_PASSWORD,'[REDACTED]').replaceAll(RABBIT_PASSWORD,'[REDACTED]').replaceAll(JWT_SECRET,'[REDACTED]');console.error('FATAL:',message);record('SETUP','Disposable integration environment','FAIL',message.slice(0,650));code=1}
  finally{
    try{const out=evidence();console.log('Evidence:',out)}catch(e){console.error('Evidence save error:',e.message);code=1}
    await cleanup();
    const count=s=>results.filter(r=>r.status===s).length;
    console.log(`Plan 03: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('BLOCKED')} BLOCKED`);
    if(createdDB||createdRabbit)console.log('Disposable containers retained for review. To clean up after verification: docker rm -f fds-ddp203-postgres fds-ddp203-rabbitmq');
    process.exitCode=code;
  }
})();
