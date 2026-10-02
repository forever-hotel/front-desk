import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CheckInPrintRequestDto } from './dto/check-in-print-request.dto';
import { CheckInPrintResult } from './models/check-in-print-result';
import { CheckInPrintGateway } from './ports/check-in-print.gateway';
import { CheckInPrintRepository } from './ports/check-in-print.repository';

@Injectable()
export class CheckInPrintService {
  constructor(
    private readonly checkInPrintRepository: CheckInPrintRepository,
    private readonly checkInPrintGateway: CheckInPrintGateway,
  ) {}

  async requestPrint(
    bookingReference: string,
    dto: CheckInPrintRequestDto,
  ): Promise<CheckInPrintResult> {
    const context =
      await this.checkInPrintRepository.findPrintContext(bookingReference);

    if (!context) {
      throw new NotFoundException('Booking not found');
    }

    if (context.status !== 'CHECKED_IN') {
      throw new ConflictException(
        'Check-in documents can only be printed for a checked-in booking',
      );
    }

    if (!context.roomNumber) {
      throw new ConflictException(
        'Checked-in booking must have an assigned room before printing',
      );
    }

    try {
      const printJob = await this.checkInPrintGateway.requestPrint({
        documentType: dto.documentType,
        bookingReference: context.bookingReference,
        roomNumber: context.roomNumber,
        checkInDate: context.checkInDate,
        checkOutDate: context.checkOutDate,
      });

      return {
        status: printJob.status,
        documentType: dto.documentType,
        bookingReference: context.bookingReference,
        roomNumber: context.roomNumber,
        printJobReference: printJob.printJobReference,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Check-in document printing is temporarily unavailable',
      );
    }
  }
}
