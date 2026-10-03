export interface CheckoutPreparation {
  bookingReference: string;
  roomNumber: string;
  bookingStatus: 'CHECKED_IN';
  roomStatus: 'OCCUPIED';
  previouslyPaid: number;
}

export interface CheckoutBalance {
  currency: 'LKR';
  folioTotal: number;
  previouslyPaid: number;
  amountDue: number;
}
