import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { requireMatchingActor } from '../security/auth/actor-identity';
import { CurrentPrincipal } from '../security/auth/current-principal.decorator';
import {
  FdsReadAccess,
  FdsWriteAccess,
} from '../security/auth/fds-access.decorator';
import { CreateRoomChangeDto } from './dto/create-room-change.dto';
import { AvailableRoomChangeOption } from './models/available-room-change-option';
import { RoomChangeResult } from './models/room-change-result';
import { RoomChangesService } from './room-changes.service';

@Controller('room-changes')
export class RoomChangesController {
  constructor(private readonly roomChangesService: RoomChangesService) {}

  @Get(':bookingReference/available-rooms')
  @FdsReadAccess()
  findAvailableRooms(
    @Param(
      'bookingReference',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    bookingReference: string,
  ): Promise<AvailableRoomChangeOption[]> {
    return this.roomChangesService.findAvailableRooms(bookingReference);
  }

  @Post()
  @FdsWriteAccess()
  changeRoom(
    @Body()
    dto: CreateRoomChangeDto,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): Promise<RoomChangeResult> {
    requireMatchingActor(dto.performedBy, principal);

    return this.roomChangesService.changeRoom({
      ...dto,
      performedBy: principal.userId,
    });
  }
}
