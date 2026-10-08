export type FolioCategory = "ROOM_CHARGES" | "FOOD_AND_BEVERAGE" | "SERVICES";

export interface FolioItem {
  reference: string;
  description: string;
  amount: number;
  occurredAt: string;
}

export interface FolioCategorySummary {
  category: FolioCategory;
  items: FolioItem[];
  subtotal: number;
}

export interface RunningFolio {
  bookingReference: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
  bookingStatus: "CHECKED_IN";
  currency: "LKR";
  categories: FolioCategorySummary[];
  total: number;
}
