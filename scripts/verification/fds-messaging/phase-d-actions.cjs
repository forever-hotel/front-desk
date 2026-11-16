'use strict';
/** DDP-203 browser evidence helper. Execute from repo root in terminal B. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const SESSION=path.join(os.tmpdir(),'fds-ddp203-r06-session.json');
const ROOT=process.cwd();
const REPORT_DIR=path.join(ROOT,'evidence','fds-messaging-realtime');
const specs=[
 ['R06-01','Authenticated development session: room board loads and shows LIVE'],
 ['R06-02','Unauthenticated browser cannot read protected REST or connect authenticated Socket.IO'],
 ['R06-03','Actual maintenance UI change is reflected in another live browser tab'],
 ['R06-04','RabbitMQ escalation appears live in UI list and header without reload'],
 ['R06-05','WebSocket-only interruption switches UI to REST FALLBACK'],
 ['R06-06','REST polling displays a new escalation while WebSocket is unavailable'],
 ['R06-07','WebSocket restoration reconnects and refreshes REST snapshots'],
 ['R06-08','Keyboard, small-screen and console-error browser smoke check']
];
function assert(x,msg){if(!x)throw Error(msg);}
function read(){assert(fs.existsSync(SESSION),'No active Phase D server. Start run-phase-d.cjs in terminal A.');return JSON.parse(fs.readFileSync(SESSION,'utf8'));}
function write(v){fs.writeFileSync(SESSION,JSON.stringify(v,null,2),{encoding:'utf8',mode:0o600});}
function help(){console.log(`Commands (from repo root):
  node scripts/verification/fds-messaging/phase-d-actions.cjs token
  node scripts/verification/fds-messaging/phase-d-actions.cjs status
  node scripts/verification/fds-messaging/phase-d-actions.cjs escalation
  node scripts/verification/fds-messaging/phase-d-actions.cjs proxy off
  node scripts/verification/fds-messaging/phase-d-actions.cjs proxy on
  node scripts/verification/fds-messaging/phase-d-actions.cjs room-reset
  node scripts/verification/fds-messaging/phase-d-actions.cjs record R06-01 PASS "Observed ..."
  node scripts/verification/fds-messaging/phase-d-actions.cjs record R06-01 FAIL "Observed ..."
  node scripts/verification/fds-messaging/phase-d-actions.cjs finalize

Manual R06 scenarios:\n${specs.map(([id,title])=>`${id} ${title}`).join('\n')}`);}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url,token,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const payload=await r.json().catch(()=>null);return {http:r.status,body:payload};}
function current(){return `http://127.0.0.1:4305`;}
async function status(s){const [rooms,esc]=await Promise.all([get(current()+'/rooms/status',s.token),get(current()+'/realtime/escalations',s.token)]);console.log(JSON.stringify({roomsHttp:rooms.http,roomR1954:rooms.body?.find?.(x=>x.roomNumber==='R1954')?.status,escalationsHttp:esc.http,recentEscalations:Array.isArray(esc.body)?esc.body.length:null,proxyEnabled:s.proxyEnabled},null,2));}
async function publish(s){const {connect}=require(path.join(ROOT,'backend','node_modules','amqplib'));const conn=await connect(s.amqpUrl);const ch=await conn.createConfirmChannel();try{const id=crypto.randomUUID(),now=new Date().toISOString();const e={eventId:`escalation:${id}`,eventType:'task.escalated',eventVersion:1,occurredAt:now,source:'worker-management',data:{taskId:id,taskCategory:'ROOM_CLEANING',roomNumber:'R1951',priority:'HIGH',escalatedAt:now}};ch.publish('forever.events','wkms.task.escalated.v1',Buffer.from(JSON.stringify(e)),{persistent:true,messageId:e.eventId,contentType:'application/json'});await ch.waitForConfirms();console.log('Published synthetic WKMS-compatible task escalation '+id);console.log('Inspect browser Escalations and the header. This is a test publisher, not the real WKMS service.');}finally{await ch.close();await conn.close();}}
async function reset(s){const r=await get(current()+'/rooms/R1954/status',s.token,'PATCH',{targetStatus:'VACANT',notes:'DDP203 R06 browser fixture restore'});assert(r.http===200,'Room reset failed (HTTP '+r.http+'): '+JSON.stringify(r.body).slice(0,350));console.log('PASS: Synthetic room R1954 restored to VACANT via FDS backend; live clients should update.');}
function record(s,id,status,note){assert(specs.some(x=>x[0]===id),'Unknown R06 test ID');assert(['PASS','FAIL','BLOCKED'].includes(status),'Status must be PASS, FAIL, or BLOCKED');assert(note.length>=12,'Add an actual observed outcome (at least 12 characters)');assert(note.length<=600,'Keep note under 600 characters');assert(!/eyJ[A-Za-z0-9_-]{40,}/.test(note),'Do not place any JWT in evidence');s.observations[id]={status,note,time:new Date().toISOString(),method:'operator-observed browser'};write(s);console.log(status+' '+id+' — observation recorded (not an automated visual assertion).');}
function quoteCsv(v){return '"'+String(v).replaceAll('"','""').replaceAll(/[\r\n]/g,' ')+'"';}
function finalize(s){
 const rows=specs.map(([id,title])=>({id,title,status:s.observations[id]?.status||'BLOCKED',note:s.observations[id]?.note||'Not manually observed/recorded',time:s.observations[id]?.time||''}));
 assert(rows.some(x=>x.status==='PASS'||x.status==='FAIL'),'Record at least one actually observed browser check before finalizing.');
 fs.mkdirSync(REPORT_DIR,{recursive:true});const reg=path.join(REPORT_DIR,'phase-d-execution-register.csv');const md=path.join(REPORT_DIR,'phase-d-verification.md');
 assert(!fs.existsSync(reg)&&!fs.existsSync(md),'Phase D evidence already exists. Review it before creating another run; no overwrites.');
 const csv=[['test_id','scenario','status','observed_result','observed_at'].map(quoteCsv).join(','),...rows.map(x=>[x.id,x.title,x.status,x.note,x.time].map(quoteCsv).join(','))].join('\r\n')+'\r\n';
 fs.writeFileSync(reg,csv,'utf8');const counts= Object.fromEntries(['PASS','FAIL','BLOCKED'].map(st=>[st,rows.filter(x=>x.status===st).length]));
 const lines=['# DDP-203 Phase D — Real Front Desk Browser Realtime Verification','',`Recorded: ${new Date().toISOString()}`,'','Environment: isolated local Next.js :3102, FDS :4305, Socket.IO bridge :4326, disposable PostgreSQL :55434 and RabbitMQ :5673.','Localhost development JWT authentication only; centralized production-auth BFF is NOT implemented.','The escalation action publishes a WKMS-compatible test message, not a WKMS-originated event.','Operator-recorded browser observations, not automated Playwright assertions. No JWTs or DB credentials in evidence.','',`**Result: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.BLOCKED} BLOCKED.**`,'',...rows.map(x=>`- **${x.status}** ${x.id}: ${x.title} — ${x.note}`),'','## Limitations','- R06 validation applies to local development browser UX, not production authentication or deployment.','- W04 WKMS internal REST integration remains separately BLOCKED.','- Phase C automatic broker recovery was tested separately and is not re-tested by browser network interruption.','- Browser/screenshots must be genuinely observed by the tester.','- Socket.IO retries transport reconnection without a fixed attempt limit, with a maximum retry delay of 5 seconds. Invalid authentication must remain rejected.'];
 fs.writeFileSync(md,lines.join('\n')+'\n','utf8');console.log(`Phase D evidence: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.BLOCKED} BLOCKED`);console.log('Created '+reg+' and '+md);if(counts.FAIL||counts.BLOCKED)console.log('R06 is not fully passed; preserve statuses until independently verified.');
}
(async()=>{try{
 const a=process.argv[2]||'help';if(a==='help'){help();return;}const s=read();
 if(a==='token'){
   assert(process.platform==='win32','Clipboard action currently supports Windows only');
   const p=cp.spawnSync('clip.exe',[],{input:s.token,encoding:'utf8',timeout:7000,windowsHide:true});assert(p.status===0,'Cannot copy test token to Windows clipboard');
   console.log('Local, expiring TEST receptionist JWT copied to clipboard. Do NOT paste it into chat/screenshots.');
   console.log('In http://127.0.0.1:3102/rooms browser DevTools Console:');
   console.log("sessionStorage.setItem('fds:dev-test-jwt', 'PASTE_COPIED_TEST_TOKEN_HERE'); location.reload();");
   console.log('Replace only the placeholder by pasting from clipboard.');
 }else if(a==='status')await status(s);
 else if(a==='escalation')await publish(s);
 else if(a==='proxy'){
   const v=process.argv[3];assert(['on','off'].includes(v),'Use proxy on or proxy off');s.proxyEnabled=v==='on';write(s);console.log('Socket.IO proxy '+(s.proxyEnabled?'ENABLED':'DISABLED')+'; REST stays online.');
 }else if(a==='room-reset')await reset(s);
 else if(a==='record')record(s,process.argv[3],process.argv[4],process.argv.slice(5).join(' '));
 else if(a==='finalize')finalize(s);
 else throw Error('Unknown action '+a+'; run help');
 }catch(e){console.error('ERROR: '+e.message);process.exitCode=1;}})();
