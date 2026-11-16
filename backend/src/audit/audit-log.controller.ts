import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedPrincipalGuard } from '../security/auth/authenticated-principal.guard';
import { Roles } from '../security/auth/roles.decorator';
import { RolesGuard } from '../security/auth/roles.guard';
import { SystemRole } from '../security/auth/system-role';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import type { AuditLogEntry } from './models/audit-log-entry';

@Controller('audit-logs')
@UseGuards(AuthenticatedPrincipalGuard, RolesGuard)
@Roles(SystemRole.RECEPTIONIST, SystemRole.MANAGER)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findMany(
    @Query()
    query: AuditLogQueryDto,
  ): Promise<AuditLogEntry[]> {
    return this.auditLogService.findMany(query);
  }

  @Get(':logId')
  async findById(
    @Param(
      'logId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    logId: string,
  ): Promise<AuditLogEntry> {
    return this.auditLogService.findById(logId);
  }
}
