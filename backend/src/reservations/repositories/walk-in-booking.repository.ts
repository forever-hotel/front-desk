import type {
  CreateWalkInBookingRecord,
  WalkInBookingResult,
  WalkInRoomTypeDetails,
} from '../models/walk-in-booking-result';

export abstract class WalkInBookingRepository {
  abstract findRoomType(
    roomTypeId: string,
  ): Promise<WalkInRoomTypeDetails | null>;

  abstract createWalkInBooking(
    input: CreateWalkInBookingRecord,
  ): Promise<WalkInBookingResult>;
}
