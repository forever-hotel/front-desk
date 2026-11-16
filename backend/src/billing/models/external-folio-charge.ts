import { FolioCategory } from './folio-category';

export type ExternalFolioCategory =
  FolioCategory.FOOD_AND_BEVERAGE | FolioCategory.SERVICES;

export interface ExternalFolioCharge {
  reference: string;
  category: ExternalFolioCategory;
  description: string;
  amount: number;
  occurredAt: string;
}
