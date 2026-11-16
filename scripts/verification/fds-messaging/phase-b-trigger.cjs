'use strict';
// Runs the actual WKMS production escalation & outbox services once in a temporary Nest app context.
// Copied by the Phase B runner into the isolated WKMS clone, not the user's original WKMS repo.
const {NestFactory}=require('@nestjs/core');
const {AppModule}=require('./dist/app.module.js');
const {TaskEscalationService}=require('./dist/tasks/task-escalation.service.js');
const {OutboxDispatcherService}=require('./dist/messaging/outbox/outbox-dispatcher.service.js');
(async()=>{
  let app;
  try {
    app=await NestFactory.createApplicationContext(AppModule,{logger:false});
    await app.get(TaskEscalationService).processOverdueTasks();
    await app.get(OutboxDispatcherService).dispatchPendingEvents();
    console.log('WKMS real escalation service and outbox dispatcher invoked successfully.');
  } catch(e) {
    console.error('WKMS_ESCALATION_TRIGGER_FAILED:',e.message);
    process.exitCode=1;
  } finally {if(app) await app.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
