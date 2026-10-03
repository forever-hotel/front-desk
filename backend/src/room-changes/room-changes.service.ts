import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateRoomChangeDto } from './dto/create-room-change.dto';
import { AvailableRoomChangeOption } from './models/available-room-change-option';
import { RoomChangeResult } from './models/room-change-result';
import { RoomChangeRepository } from './ports/room-change.repository';

@Injectable()
export class RoomChangesService {
  constructor(private readonly roomChangeRepository: RoomChangeRepository) {}

  findAvailableRooms(
    bookingReference: string,
  ): Promise<AvailableRoomChangeOption[]> {
    return this.roomChangeRepository.findAvailableRooms(bookingReference);
  }

  async changeRoom(dto: CreateRoomChangeDto): Promise<RoomChangeResult> {
    const targetRoomNumber = dto.targetRoomNumber.trim().toUpperCase();

    if (!targetRoomNumber) {
      throw new BadRequestException('targetRoomNumber is required');
    }

    return this.roomChangeRepository.changeRoom({
      bookingReference: dto.bookingReference,
      targetRoomNumber,
      performedBy: dto.performedBy,
      reason: dto.reason?.trim() || undefined,
    });
  }
}
