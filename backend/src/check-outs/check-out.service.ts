import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { FolioService } from '../billing/folio.service';
import { FossSessionGateway } from '../check-ins/ports/foss-session.gateway';
import { CheckoutCompletedPublisher } from '../messaging/publishers/checkout-completed.publisher';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { RoomStatus } from '../rooms/models/room-status';
import { CreateCheckOutDto } from './dto/create-check-out.dto';
import { CheckoutBalance } from './models/checkout-balance';
import { CheckoutResult } from './models/checkout-result';
import { CheckoutPaymentGateway } from './ports/checkout-payment.gateway';
import { CheckoutRepository } from './ports/checkout.repository';

@Injectable()
export class CheckOutService {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly checkoutPaymentGateway: CheckoutPaymentGateway,
    private readonly folioService: FolioService,
    private readonly fossSessionGateway: FossSessionGateway,
    private readonly checkoutCompletedPublisher: CheckoutCompletedPublisher,

    @Optional()
    private readonly realtimePublisherService?: RealtimePublisherService,
  ) {}

  async checkOut(dto: CreateCheckOutDto): Promise<CheckoutResult> {
    /*
     * Validate the acting receptionist and active
     * booking/room state before any payment attempt.
     */
    const preparation = await this.checkoutRepository.prepareCheckout({
      bookingReference: dto.bookingReference,
      performedBy: dto.performedBy,
    });

    /*
     * Plan 11 remains the authoritative folio
     * composition path.
     */
    const folio = await this.folioService.getRunningFolio(dto.bookingReference);

    const balance = this.calculateBalance(
      folio.total,
      preparation.previouslyPaid,
    );

    if (balance.amountDue > 0 && !dto.paymentMethod) {
      throw new BadRequestException(
        'paymentMethod is required when a final payment is due',
      );
    }

    if (balance.amountDue > 0 && dto.paymentMethod) {
      try {
        const paymentResult =
          await this.checkoutPaymentGateway.processFinalPayment({
            bookingReference: dto.bookingReference,
            amount: balance.amountDue,
            currency: 'LKR',
            paymentMethod: dto.paymentMethod,
          });

        if (paymentResult.status !== 'COMPLETED') {
          throw new HttpException(
            'Final payment failed',
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      } catch (error) {
        if (
          error instanceof HttpException &&
          error.getStatus() === HttpStatus.PAYMENT_REQUIRED
        ) {
          throw error;
        }

        throw new HttpException(
          'Final payment failed',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    /*
     * Persistent checkout mutations happen only after
     * final payment succeeds or when no new payment is
     * required.
     */
    const committed = await this.checkoutRepository.commitCheckout({
      bookingReference: dto.bookingReference,
      performedBy: dto.performedBy,
      roomNumber: preparation.roomNumber,
      folioTotal: balance.folioTotal,
      previouslyPaid: balance.previouslyPaid,
      finalPaymentAmount: balance.amountDue,
      paymentMethod: balance.amountDue > 0 ? dto.paymentMethod : undefined,
    });

    /*
     * The room is now transactionally committed as
     * REQUIRES_CLEANING, so every connected Front Desk
     * screen can update immediately.
     */
    this.realtimePublisherService?.publishRoomStatusUpdated({
      roomNumber: committed.roomNumber,
      status: RoomStatus.REQUIRES_CLEANING,
      source: 'CHECK_OUT',
      performedBy: dto.performedBy,
    });

    /*
     * The RabbitMQ checkout-completed event belongs to
     * the successfully committed hotel checkout.
     *
     * It is deliberately attempted before FOSS
     * deactivation, because FOSS failure must not stop
     * WKMS from receiving the room-cleaning trigger.
     */
    await this.checkoutCompletedPublisher.publishCheckoutCompleted({
      bookingReference: committed.bookingReference,
      roomNumber: committed.roomNumber,
    });

    /*
     * FOSS is a separate subsystem.
     * Deactivation happens only AFTER the core checkout
     * transaction commits.
     */
    try {
      const fossSession = await this.fossSessionGateway.deactivateGuestSession({
        bookingReference: committed.bookingReference,
        roomNumber: committed.roomNumber,
      });

      return {
        ...committed,
        fossSession,
      };
    } catch {
      return {
        ...committed,
        fossSession: {
          status: 'FAILED',
          failureCode: 'FOSS_DEACTIVATION_FAILED',
        },
      };
    }
  }

  private calculateBalance(
    folioTotal: number,
    previouslyPaid: number,
  ): CheckoutBalance {
    if (!Number.isSafeInteger(folioTotal) || folioTotal < 0) {
      throw new ConflictException('Folio total is invalid for checkout');
    }

    if (!Number.isSafeInteger(previouslyPaid) || previouslyPaid < 0) {
      throw new ConflictException(
        'Completed-payment total is invalid for checkout',
      );
    }

    const amountDue = folioTotal - previouslyPaid;

    if (!Number.isSafeInteger(amountDue) || amountDue < 0) {
      throw new ConflictException(
        'Completed payments exceed the current folio total',
      );
    }

    return {
      currency: 'LKR',
      folioTotal,
      previouslyPaid,
      amountDue,
    };
  }
}
