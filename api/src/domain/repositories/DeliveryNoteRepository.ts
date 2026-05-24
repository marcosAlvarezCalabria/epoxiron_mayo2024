import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteInput,
  DeliveryNoteStatus
} from "../entities/DeliveryNote.js";

export interface DeliveryNoteRepository {
  findAll(filters: DeliveryNoteFilters): Promise<DeliveryNote[]>;
  findById(id: string): Promise<DeliveryNote | null>;
  create(input: DeliveryNoteInput & { customerName: string; totalAmount: number; items: DeliveryNote["items"] }): Promise<DeliveryNote>;
  update(
    id: string,
    input: DeliveryNoteInput & { customerName: string; totalAmount: number; items: DeliveryNote["items"] }
  ): Promise<DeliveryNote>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: DeliveryNoteStatus): Promise<DeliveryNote>;
}
