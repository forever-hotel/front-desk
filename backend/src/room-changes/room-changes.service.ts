import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { RoomStatus } from '../rooms/models/room-status';
import { CreateRoomChangeDto } from './dto/create-room-change.dto';
import { AvailableRoomChangeOption } from './models/available-room-change-option';
import { RoomChangeResult } from './models/room-change-result';
import { RoomChangeRepository } from './ports/room-change.repository';

@Injectable()
export class RoomChangesService {
  constructor(
    private readonly roomChangeRepository: RoomChangeRepository,

    @Optional()
    private readonly realtimePublisherService?: RealtimePublisherService,
  ) {}

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

    const result = await this.roomChangeRepository.changeRoom({
      bookingReference: dto.bookingReference,
      targetRoomNumber,
      performedBy: dto.performedBy,
      reason: dto.reason?.trim() || undefined,
    });

    /*
     * A successful room change affects two rooms.
     *
     * Old room -> REQUIRES_CLEANING
     * New room -> OCCUPIED
     */
    this.realtimePublisherService?.publishRoomStatusUpdated({
      roomNumber: result.previousRoomNumber,
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'ROOM_CHANGE',
      performedBy: dto.performedBy,
    });

    this.realtimePublisherService?.publishRoomStatusUpdated({
      roomNumber: result.roomNumber,
      status: RoomStatus.OCCUPIED,
      source: 'ROOM_CHANGE',
      performedBy: dto.performedBy,
    });

    return result;
  }
}
