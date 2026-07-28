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

export interface InvoicePreview {
  issuer: { legalName: string; vat: string; street: string; city: string; zip: string; province: string; countryCode: string };
  customer: { customerId: string; legalName: string; vat: string; street: string; street2: string | null; city: string; zip: string; province: string | null; countryCode: string; paymentTermCode: string | null };
  deliveryNotes: Array<{ id: string; number: string; date: string }>;
  lines: Array<{ deliveryNoteId: string; deliveryNoteNumber: string; description: string; quantity: string; unitPrice: string; subtotal: string; taxRate: string; total: string; position: number }>;
  issueDate: string;
  deliveryNoteCount: number;
  lineCount: number;
  warnings: string[];
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  series: string | null;
}

export interface InvoicePreviewResponse {
  preview: InvoicePreview;
  previewToken: string;
  expiresAt: string;
}
