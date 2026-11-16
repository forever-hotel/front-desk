'use strict';
/** DDP-203 R06: locally isolated FDS REST/Socket.IO + actual Next.js UI.
 * No seeded DB reset, no broker restart, no application source edits.
 * Keep this process running while using phase-d-actions.cjs in another terminal.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const net = require('node:net');

const ROOT = process.cwd();
const BACK = path.join(ROOT,'backend');
const FRONT = path.join(ROOT,'frontend');
const P = {front:3102,backend:4305,wsProxy:4326,pg:55434,rabbit:5673};
const ROOM = 'R1954';
const STAFF = '66666666-6666-4666-8666-666666666666';
const DB = 'front_desk_test';
const SESSION = path.join(os.tmpdir(),'fds-ddp203-r06-session.json');
const SECRET = crypto.randomBytes(48).toString('hex');
const PRIVATE_VALUES = [SECRET];
const started = [];
let server, liveSockets = new Set(), poller;
let backendLog = '', frontendLog = '';
let stopping = false;
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
function assert(b,msg){if(!b) throw new Error(msg);}
function exec(command,args=[],opts={}){
  const p = cp.spawnSync(command,args,{cwd:ROOT,encoding:'utf8',timeout:45000,maxBuffer:3e6,...opts});
  if(p.error || p.status!==0) throw Error(`${command} exited unsuccessfully; verify the local Docker/Git environment.`);
  return p.stdout.trim();
}
const docker = (...args) => exec('docker',args);
const sql = q => docker('exec','fds-ddp203-postgres','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB,'-Atc',q);
function containerEnv(name,key){
  const vars = JSON.parse(docker('inspect','--format','{{json .Config.Env}}',name));
  const line = vars.find(s=>s.startsWith(key+'='));
  assert(line && line.slice(key.length+1).length>0,`Missing required test-only ${key} in ${name}`);
  return line.slice(key.length+1);
}
const redact = s => PRIVATE_VALUES.reduce((v,secret)=>v.replaceAll(secret,'[REDACTED]'),String(s||''));
function jwt(){
 const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const a=b({alg:'HS256',typ:'JWT'}),now=Math.floor(Date.now()/1000);
 const c=b({sub:STAFF,role:'RECEPTIONIST',iss:'forever-hotel-auth',iat:now,exp:now+10800});
 return a+'.'+c+'.'+crypto.createHmac('sha256',SECRET).update(a+'.'+c).digest('base64url');
}
async function busy(port){return new Promise(res=>{const s=net.connect({host:'127.0.0.1',port}); const t=setTimeout(()=>{s.destroy();res(false)},1100);s.once('connect',()=>{clearTimeout(t);s.destroy();res(true)});s.once('error',()=>{clearTimeout(t);s.destroy();res(false)});});}
async function until(fn,label,timeout=95000){const end=Date.now()+timeout;while(Date.now()<end){try{if(await fn())return;}catch{}await wait(600);}throw Error('Timed out waiting for '+label);}
function spawnNode(script,args,cwd,env,which){
 const p=cp.spawn(process.execPath,[script,...args],{cwd,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 function receive(b){const clean=redact(b);if(which==='backend')backendLog=(backendLog+clean).slice(-17000);else frontendLog=(frontendLog+clean).slice(-17000);}
 p.stdout.on('data',receive);p.stderr.on('data',receive);started.push(p);return p;
}
function session(){return JSON.parse(fs.readFileSync(SESSION,'utf8'));}
function sessionWrite(v){fs.writeFileSync(SESSION,JSON.stringify(v,null,2),{encoding:'utf8',mode:0o600});}
function proxy(){
 server=net.createServer(client=>{
   let s; try{s=session();}catch{client.destroy();return;}
   if(!s.proxyEnabled){client.destroy();return;}
   const upstream=net.connect({host:'127.0.0.1',port:P.backend});
   const pair={client,upstream};liveSockets.add(pair);
   const close=()=>{client.destroy();upstream.destroy();liveSockets.delete(pair);};
   client.on('error',()=>{});upstream.on('error',()=>{});
   client.on('close',close);upstream.on('close',close);
   client.pipe(upstream);upstream.pipe(client);
 });
 server.listen(P.wsProxy,'127.0.0.1');
 let previous=true;
 poller=setInterval(()=>{
   let desired=true;try{desired=!!session().proxyEnabled;}catch{return;}
   if(previous && !desired){for(const pair of [...liveSockets]){pair.client.destroy();pair.upstream.destroy();}}
   if(previous!==desired){console.log(desired?'Socket.IO proxy restored: browser can reconnect.':'Socket.IO proxy interrupted: REST remains available.');}
   previous=desired;
 },300);
}
async function startup(){
 assert(exec('git',['branch','--show-current'])==='feature/91-fds-messaging-realtime-verification','Switch to DDP-203 feature branch.');
 for(const file of ['backend/node_modules/@nestjs/cli/bin/nest.js','frontend/node_modules/next/dist/bin/next','evidence/fds-messaging-realtime/phase-c-verification.md']) assert(fs.existsSync(path.join(ROOT,file)),`Missing ${file}`);
 assert(!fs.existsSync(SESSION),'Prior browser test session file exists; inspect/clean it before starting another.');
 for(const p of [P.backend,P.front,P.wsProxy]) assert(!(await busy(p)),`Port ${p} is in use. Stop other test/development servers first.`);
 assert(docker('inspect','--format','{{.State.Running}}','fds-ddp203-postgres')==='true','Disposable PostgreSQL must be running');
 assert(docker('inspect','--format','{{.State.Running}}','fds-ddp203-rabbitmq')==='true','Disposable RabbitMQ must be running');
 assert(docker('port','fds-ddp203-postgres','5432/tcp').includes('127.0.0.1:55434'),'Unexpected PostgreSQL port mapping');
 assert(docker('port','fds-ddp203-rabbitmq','5672/tcp').includes('127.0.0.1:5673'),'Unexpected RabbitMQ port mapping');
 assert(sql('SELECT current_database()')===DB,'Wrong database');
 assert(sql("SELECT status::text FROM rooms WHERE room_number='R1954'")==='VACANT','R1954 must be VACANT from Phase A before browser maintenance test');
 assert(sql(`SELECT count(*) FROM staff_users WHERE worker_id='${STAFF}' AND role='RECEPTIONIST' AND is_active=true`)==='1','Missing active synthetic receptionist');
 const pgPass=containerEnv('fds-ddp203-postgres','POSTGRES_PASSWORD');
 const amqpUser=containerEnv('fds-ddp203-rabbitmq','RABBITMQ_DEFAULT_USER');
 const amqpPass=containerEnv('fds-ddp203-rabbitmq','RABBITMQ_DEFAULT_PASS');
 PRIVATE_VALUES.push(pgPass,amqpUser,amqpPass);
 const amqpUrl='amqp://'+encodeURIComponent(amqpUser)+':'+encodeURIComponent(amqpPass)+'@127.0.0.1:'+P.rabbit;
 PRIVATE_VALUES.push(amqpUrl);
 const {Pool}=require(path.join(BACK,'node_modules','pg'));
 const pool=new Pool({host:'127.0.0.1',port:P.pg,user:'postgres',password:pgPass,database:DB,ssl:false,max:1});
 try{await pool.query('SELECT 1');}finally{await pool.end();}
 const amqp=require(path.join(BACK,'node_modules','amqplib'));
 let c=await amqp.connect(amqpUrl);await c.close();
 console.log('PASS: Disposable database, receptionist fixture and RabbitMQ verified.');
 sessionWrite({createdAt:new Date().toISOString(),pid:process.pid,token:jwt(),amqpUrl,proxyEnabled:true,room:ROOM,observations:{}});
 proxy();
 const backendEnv={...process.env,NODE_ENV:'test',PORT:String(P.backend),DB_HOST:'127.0.0.1',DB_PORT:String(P.pg),DB_USERNAME:'postgres',DB_PASSWORD:pgPass,DB_NAME:DB,DB_SSL:'false',DB_SYNCHRONIZE:'false',DB_LOGGING:'false',JWT_SECRET:SECRET,JWT_ISSUER:'forever-hotel-auth',FDS_AUTH_PROVIDER:'legacy',RABBITMQ_ENABLED:'true',RABBITMQ_URL:amqpUrl,RABBITMQ_EXCHANGE:'forever.events',WKMS_INTEGRATION_ENABLED:'false',FDS_ALLOWED_ORIGINS:'http://localhost:3102,http://127.0.0.1:3102'};
 delete backendEnv.DATABASE_URL;
 const back=spawnNode(path.join(BACK,'node_modules/@nestjs/cli/bin/nest.js'),['start'],BACK,backendEnv,'backend');
 try{
   await until(async()=>{
     if(back.exitCode!==null)throw Error('FDS backend exited');
     const r=await fetch(`http://127.0.0.1:${P.backend}/health/ready`,{headers:{Authorization:'Bearer '+session().token}});return r.ok&&(await r.json()).database==='up';
   },'FDS readiness');
 }catch(e){throw Error(e.message+'\nFDS startup logs:\n'+backendLog.slice(-2600));}
 console.log('PASS: Real FDS backend with repaired RabbitMQ subscription is ready.');
 const frontEnv={...process.env,NODE_ENV:'development',NEXT_PUBLIC_ENABLE_DEV_TEST_AUTH:'true',NEXT_PUBLIC_FDS_CENTRAL_AUTH_ENABLED:'false',NEXT_PUBLIC_API_BASE_URL:`http://127.0.0.1:${P.backend}`,NEXT_PUBLIC_WS_URL:`http://127.0.0.1:${P.wsProxy}`};
 const next=spawnNode(path.join(FRONT,'node_modules/next/dist/bin/next'),['dev','--hostname','127.0.0.1','--port',String(P.front)],FRONT,frontEnv,'frontend');
 try{await until(async()=>{
   if(next.exitCode!==null)throw Error('Next.js exited (stop other dev instances sharing frontend/.next).');
   const r=await fetch(`http://127.0.0.1:${P.front}/rooms`);return r.status===200;
 },'Next.js /rooms',150000);}catch(e){throw Error(e.message+'\nFrontend logs:\n'+frontendLog.slice(-3000));}
 console.log('\nPASS: Actual Next.js /rooms page is serving at http://127.0.0.1:3102/rooms');
 console.log('Browser test is READY. This is NOT a claim that visual R06 checks passed.');
 console.log('Open a SECOND PowerShell terminal at the repo root and use phase-d-actions.cjs.');
 console.log('Press Ctrl+C here only after you have saved the Phase D evidence.');
}
async function stop(){if(stopping)return;stopping=true;
 if(poller)clearInterval(poller);for(const p of [...liveSockets]){p.client.destroy();p.upstream.destroy();}
 try{server?.close();}catch{}
 for(const p of started){if(!p.pid)continue;try{if(process.platform==='win32')cp.spawnSync('taskkill',['/PID',String(p.pid),'/T','/F'],{stdio:'ignore',timeout:14000});else p.kill('SIGTERM');}catch{}}
 try{fs.unlinkSync(SESSION);}catch{}
 console.log('\nStopped Phase D servers; test-only browser token expired with the server.');
}
process.on('SIGINT',()=>{void stop().then(()=>process.exit(0));});
process.on('SIGTERM',()=>{void stop().then(()=>process.exit(0));});
startup().catch(async error=>{console.error('PHASE D SETUP FAILED: '+redact(error.message));await stop();process.exitCode=1;});
