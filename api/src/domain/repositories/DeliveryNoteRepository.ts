import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteInput,
  DeliveryNoteStatus
} from "../entities/DeliveryNote.js";

export interface DeliveryNoteRepository {
  findAll(filters: DeliveryNoteFilters): Promise<DeliveryNote[]>;
  count(filters: DeliveryNoteFilters): Promise<number>;
  findById(id: string): Promise<DeliveryNote | null>;
  findLatestNumberForYear(year: number): Promise<string | null>;
  create(
    input: DeliveryNoteInput & {
      number: string;
      customerName: string;
      totalAmount: number;
      items: DeliveryNote["items"];
    }
  ): Promise<DeliveryNote>;
  update(
    id: string,
    input: DeliveryNoteInput & {
      number: string;
      customerName: string;
      totalAmount: number;
      items: DeliveryNote["items"];
    }
  ): Promise<DeliveryNote>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: DeliveryNoteStatus): Promise<DeliveryNote>;
}
