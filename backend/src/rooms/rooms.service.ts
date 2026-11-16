import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { RoomStatusBoardItem } from './models/room-status-board-item';
import { RoomStatusTransitionResult } from './models/room-status-transition-result';
import { RoomStatus } from './models/room-status';
import { RoomRepository } from './ports/room.repository';

const ALLOWED_CURRENT_STATUSES_BY_TARGET: Record<
  RoomStatus,
  readonly RoomStatus[]
> = {
  [RoomStatus.VACANT]: [
    RoomStatus.REQUIRES_CLEANING,
    RoomStatus.UNDER_MAINTENANCE,
  ],

  /*
   * OCCUPIED remains owned by the
   * transactional guest check-in and
   * room-change workflows.
   */
  [RoomStatus.OCCUPIED]: [],

  /*
   * REQUIRES_CLEANING remains owned by
   * checkout and room-change workflows.
   */
  [RoomStatus.REQUIRES_CLEANING]: [],

  /*
   * Only a clean/vacant room can be
   * manually blocked for maintenance.
   */
  [RoomStatus.UNDER_MAINTENANCE]: [RoomStatus.VACANT],
};

@Injectable()
export class RoomsService {
  constructor(
    private readonly roomRepository: RoomRepository,

    @Optional()
    private readonly realtimePublisherService?: RealtimePublisherService,
  ) {}

  getStatusBoard(): Promise<RoomStatusBoardItem[]> {
    return this.roomRepository.findAllStatuses();
  }

  async updateStatus(
    roomNumber: string,
    dto: UpdateRoomStatusDto,
  ): Promise<RoomStatusTransitionResult> {
    const normalizedRoomNumber = roomNumber.trim().toUpperCase();

    if (!normalizedRoomNumber) {
      throw new BadRequestException('roomNumber is required');
    }

    const outcome = await this.roomRepository.transitionStatus({
      roomNumber: normalizedRoomNumber,
      targetStatus: dto.targetStatus,
      allowedCurrentStatuses:
        ALLOWED_CURRENT_STATUSES_BY_TARGET[dto.targetStatus],
      performedBy: dto.performedBy,
      notes: dto.notes?.trim() || undefined,
    });

    if (outcome.kind === 'not_found') {
      throw new NotFoundException('Room not found');
    }

    if (outcome.kind === 'same_state') {
      throw new ConflictException(
        `Room ${normalizedRoomNumber} is already ${outcome.currentStatus}`,
      );
    }

    if (outcome.kind === 'blocked') {
      throw new ConflictException(
        `Room status transition ${outcome.currentStatus} -> ${dto.targetStatus} is not allowed`,
      );
    }

    const result = outcome.value;

    this.realtimePublisherService?.publishRoomStatusUpdated({
      roomNumber: result.roomNumber,
      status: result.status,
      source: 'ROOM_STATUS',
      performedBy: dto.performedBy,
    });

    return result;
  }
}
