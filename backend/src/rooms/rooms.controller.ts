import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { RoomStatusBoardItem } from './models/room-status-board-item';
import { RoomStatusTransitionResult } from './models/room-status-transition-result';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('status')
  getStatusBoard(): Promise<RoomStatusBoardItem[]> {
    return this.roomsService.getStatusBoard();
  }

  @Patch(':roomNumber/status')
  updateStatus(
    @Param('roomNumber') roomNumber: string,
    @Body() dto: UpdateRoomStatusDto,
  ): Promise<RoomStatusTransitionResult> {
    return this.roomsService.updateStatus(roomNumber, dto);
  }
}
