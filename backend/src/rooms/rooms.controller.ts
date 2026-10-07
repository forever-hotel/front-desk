import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../security/auth/authenticated-principal';
import { requireMatchingActor } from '../security/auth/actor-identity';
import { CurrentPrincipal } from '../security/auth/current-principal.decorator';
import {
  FdsReadAccess,
  FdsWriteAccess,
} from '../security/auth/fds-access.decorator';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { RoomStatusBoardItem } from './models/room-status-board-item';
import { RoomStatusTransitionResult } from './models/room-status-transition-result';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('status')
  @FdsReadAccess()
  getStatusBoard(): Promise<RoomStatusBoardItem[]> {
    return this.roomsService.getStatusBoard();
  }

  @Patch(':roomNumber/status')
  @FdsWriteAccess()
  updateStatus(
    @Param('roomNumber')
    roomNumber: string,

    @Body()
    dto: UpdateRoomStatusDto,

    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): Promise<RoomStatusTransitionResult> {
    const claimedActor = dto.performedBy ?? principal.userId;

    requireMatchingActor(claimedActor, principal);

    return this.roomsService.updateStatus(roomNumber, {
      ...dto,
      performedBy: principal.userId,
    });
  }
}
