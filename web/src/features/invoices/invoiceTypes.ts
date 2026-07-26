export type InvoiceLocalState =
  | "CREATING"
  | "CREATED_REMOTE"
  | "LINKED"
  | "RECONCILING"
  | "FAILED";
export type VerifactuState = "NOT_SENT" | "PENDING" | "ACCEPTED" | "REJECTED";

export interface Invoice {
  id: string;
  number: string | null;
  customer: {
    customerId: string;
    legalName: string;
    vat: string;
  };
  subtotal: string;
  taxAmount: string;
  total: string;
  localState: InvoiceLocalState;
  verifactuState: VerifactuState;
  externalInvoiceId: string | null;
  pdfAvailable: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  deliveryNoteIds: string[];
  createdAt: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
