import { FolioCategorySummary } from './folio-category-summary';

export interface RunningFolio {
  bookingReference: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  bookingStatus: 'CHECKED_IN';
  currency: 'LKR';
  categories: FolioCategorySummary[];
  total: number;
}
