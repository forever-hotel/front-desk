import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { RoomStatus } from '../rooms/models/room-status';
import { CheckInRequestDto } from './dto/check-in-request.dto';
import { IdVerificationMethod } from './dto/check-in-verification.dto';
import { CheckInResult, FossSessionResult } from './models/check-in-result';
import { CheckInRepository } from './ports/check-in.repository';
import { FossSessionGateway } from './ports/foss-session.gateway';

@Injectable()
export class CheckInService {
  constructor(
    private readonly checkInRepository: CheckInRepository,
    private readonly fossSessionGateway: FossSessionGateway,

    @Optional()
    private readonly realtimePublisherService?: RealtimePublisherService,
  ) {}

  async checkIn(dto: CheckInRequestDto): Promise<CheckInResult> {
    const verification = dto.verification;

    if (verification.verificationMethod === IdVerificationMethod.SCANNED_COPY) {
      if (!verification.documentStorageKey?.trim()) {
        throw new BadRequestException(
          'documentStorageKey is required for scanned-copy verification',
        );
      }
    }

    if (
      verification.verificationMethod === IdVerificationMethod.PHYSICAL_DOCUMENT
    ) {
      if (verification.documentStorageKey || verification.documentSha256) {
        throw new BadRequestException(
          'Physical-document verification must not include scanned-document metadata',
        );
      }
    }

    const committedCheckIn = await this.checkInRepository.checkIn({
      bookingReference: dto.bookingReference,
      roomNumber: dto.roomNumber,
      verification: {
        documentType: verification.documentType,
        verificationMethod: verification.verificationMethod,
        verifiedBy: verification.verifiedBy,
        documentStorageKey:
          verification.documentStorageKey?.trim() || undefined,
        documentSha256:
          verification.documentSha256?.trim().toLowerCase() || undefined,
        notes: verification.notes?.trim() || undefined,
      },
    });

    /*
     * The database transaction has committed at this point.
     * Front Desk clients can therefore safely receive OCCUPIED.
     */
    this.realtimePublisherService?.publishRoomStatusUpdated({
      roomNumber: committedCheckIn.roomNumber,
      status: RoomStatus.OCCUPIED,
      source: 'CHECK_IN',
      performedBy: verification.verifiedBy,
    });

    let fossSession: FossSessionResult;

    try {
      fossSession = await this.fossSessionGateway.activateGuestSession({
        bookingReference: committedCheckIn.bookingReference,
        roomNumber: committedCheckIn.roomNumber,
        checkOutDate: committedCheckIn.checkOutDate,
      });
    } catch {
      fossSession = {
        status: 'FAILED',
        sessionReference: null,
        validUntilDate: committedCheckIn.checkOutDate,
        failureCode: 'FOSS_ACTIVATION_FAILED',
      };
    }

    return {
      status: committedCheckIn.status,
      bookingReference: committedCheckIn.bookingReference,
      roomNumber: committedCheckIn.roomNumber,
      bookingStatus: committedCheckIn.bookingStatus,
      roomStatus: committedCheckIn.roomStatus,
      verification: committedCheckIn.verification,
      auditLogId: committedCheckIn.auditLogId,
      fossSession,
    };
  }
}
