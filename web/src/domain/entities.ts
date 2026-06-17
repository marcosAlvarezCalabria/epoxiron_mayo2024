export interface SpecialPiece {
  id?: string;
  name: string;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  grosorPrecio: number | null;
  specialPieces: SpecialPiece[];
}

export interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  pricePerLinearMeter: number;
  pricePerSquareMeter: number;
  minimumRate: number;
  grosorPrecio?: number | null;
  specialPieces: SpecialPiece[];
}

export type DeliveryNoteStatus = "DRAFT" | "PENDING" | "REVIEWED";
export type DeliveryNoteTexture = "NORMAL" | "MATE" | "TEXTURADO" | "GOFRADO";
export type DeliveryNotePricingMode = "DIMENSIONS" | "UNIT";

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
  date: string;
  items: DeliveryNoteItem[];
}

export interface DailyDeliveryNotesReportUpload {
  id: string;
  reportDate: string;
  fileId: string;
  fileName: string;
  folderName: string;
  notesCount: number;
  webViewLink: string | null;
  lastSourceUpdatedAt: string;
  createdAt: string;
}

export interface DeliveryNoteInput {
  customerId: string;
  notes?: string | null;
  status: DeliveryNoteStatus;
  date?: string;
  items: DeliveryNoteItemDraft[];
}

export interface PricePreview {
  pricing: {
    unitPrice: number;
    totalPrice: number;
  };
}

export interface DashboardSummary {
  notes: DeliveryNote[];
  stats: {
    totalNotes: number;
    totalPieces: number;
    totalAmount: number;
    reviewed: number;
    pending: number;
  };
}

export interface DailyDeliveryNotesReportResponse {
  message: string;
  result: {
    date: string;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
  };
}

export interface DeliveryNotesListResponse {
  deliveryNotes: DeliveryNote[];
  pagination: {
    total: number;
    limit: number | null;
    offset: number;
    hasMore: boolean;
  };
}

export interface DailyDeliveryNotesReportUploadsListResponse {
  uploads: DailyDeliveryNotesReportUpload[];
  pagination: {
    total: number;
    limit: number | null;
    offset: number;
    hasMore: boolean;
  };
}
