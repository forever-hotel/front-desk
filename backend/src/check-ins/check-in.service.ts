import { BadRequestException, Injectable } from '@nestjs/common';
import { CheckInRequestDto } from './dto/check-in-request.dto';
import { IdVerificationMethod } from './dto/check-in-verification.dto';
import { CheckInResult } from './models/check-in-result';
import { CheckInRepository } from './ports/check-in.repository';

@Injectable()
export class CheckInService {
  constructor(private readonly checkInRepository: CheckInRepository) {}

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

    return await this.checkInRepository.checkIn({
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
  }
}
