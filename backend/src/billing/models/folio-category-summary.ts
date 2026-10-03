import { FolioCategory } from './folio-category';
import { FolioItem } from './folio-item';

export interface FolioCategorySummary {
  category: FolioCategory;
  items: FolioItem[];
  subtotal: number;
}
