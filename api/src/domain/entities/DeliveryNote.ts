export type DeliveryNoteStatus = "DRAFT" | "PENDING" | "REVIEWED";
export type DeliveryNoteTexture = "NORMAL" | "MATE" | "TEXTURADO" | "GOFRADO";
export type DeliveryNotePricingMode = "DIMENSIONS" | "UNIT";

export interface DeliveryNoteItem {
  id?: string;
  description: string;
  color: string;
  texture: DeliveryNoteTexture;
  pricingMode: DeliveryNotePricingMode;
  customUnitPrice?: number | null;
  linearMeters?: number | null;
  squareMeters?: number | null;
  thickness?: number | null;
  primer?: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DeliveryNote {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: DeliveryNoteStatus;
  notes: string | null;
  totalAmount: number;
  date: Date;
  items: DeliveryNoteItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryNoteItemDraft {
  description: string;
  color: string;
  texture?: DeliveryNoteTexture;
  pricingMode?: DeliveryNotePricingMode;
  customUnitPrice?: number | null;
  linearMeters?: number | null;
  squareMeters?: number | null;
  thickness?: number | null;
  primer?: boolean;
  saveAsSpecialPiece?: boolean;
  quantity: number;
}

export interface DeliveryNoteInput {
  customerId: string;
  notes?: string | null;
  status: DeliveryNoteStatus;
  date?: Date;
  items: DeliveryNoteItemDraft[];
}

export interface DeliveryNoteFilters {
  date?: Date;
  dateFrom?: Date;
  dateTo?: Date;
  status?: DeliveryNoteStatus;
  customerId?: string;
  today?: boolean;
  limit?: number;
  offset?: number;
}
