import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { AuditEventWriter } from './audit-event.writer';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogRepository } from './ports/audit-log.repository';
import { PostgresAuditLogRepository } from './repositories/postgres-audit-log.repository';

@Module({
  imports: [SecurityModule],

  controllers: [AuditLogController],

  providers: [
    AuditLogService,
    AuditEventWriter,
    {
      provide: AuditLogRepository,

      useClass: PostgresAuditLogRepository,
    },
  ],

  exports: [AuditLogService, AuditLogRepository, AuditEventWriter],
})
export class AuditModule {}
