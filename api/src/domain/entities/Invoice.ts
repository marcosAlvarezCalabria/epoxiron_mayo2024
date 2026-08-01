import type { Money } from "../services/invoiceMoney.js";

export type InvoiceLocalState =
  | "CREATING"
  | "CREATED_REMOTE"
  | "LINKED"
  | "RECONCILING"
  | "FAILED";
export type OdooMoveState = "DRAFT" | "POSTED" | "CANCEL";
export type VerifactuState = "NOT_SENT" | "PENDING" | "ACCEPTED" | "REJECTED";

export interface FiscalCustomerSnapshot {
  customerId: string;
  legalName: string;
  vat: string;
  street: string;
  street2: string | null;
  city: string;
  zip: string;
  province: string | null;
  countryCode: string;
  paymentTermCode: string | null;
  externalPartnerId: string | null;
}

export interface InvoiceLine {
  id?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  subtotal: Money;
  taxRate: string;
  position: number;
}

export interface Invoice {
  id: string;
  idempotencyKey: string;
  remoteReference: string;
  series: string | null;
  number: string | null;
  customer: FiscalCustomerSnapshot;
  subtotal: Money;
  taxRate: string;
  taxAmount: Money;
  total: Money;
  localState: InvoiceLocalState;
  odooMoveState: OdooMoveState | null;
  verifactuState: VerifactuState;
  externalInvoiceId: string | null;
  verifactuDocumentId: string | null;
  verifactuQrValue: string | null;
  pdfAvailable: boolean;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  reconciliationAttempts: number;
  nextReconciliationAt: Date | null;
  lines: InvoiceLine[];
  deliveryNoteIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservedInvoice {
  invoice: Invoice;
  created: boolean;
}
