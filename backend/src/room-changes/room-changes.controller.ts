import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateRoomChangeDto } from './dto/create-room-change.dto';
import { AvailableRoomChangeOption } from './models/available-room-change-option';
import { RoomChangeResult } from './models/room-change-result';
import { RoomChangesService } from './room-changes.service';

@Controller('room-changes')
export class RoomChangesController {
  constructor(private readonly roomChangesService: RoomChangesService) {}

  @Get(':bookingReference/available-rooms')
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
  changeRoom(@Body() dto: CreateRoomChangeDto): Promise<RoomChangeResult> {
    return this.roomChangesService.changeRoom(dto);
  }
}
