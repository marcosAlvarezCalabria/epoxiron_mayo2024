import type {
  FiscalCustomerSnapshot,
  InvoiceLine,
  OdooMoveState,
  VerifactuState
} from "../entities/Invoice.js";
import type { Money } from "../services/invoiceMoney.js";

export interface ExternalPartnerRef {
  id: string;
}

export interface RemoteInvoice {
  id: string;
  number: string | null;
  moveState: OdooMoveState;
  subtotal: Money;
  taxAmount: Money;
  total: Money;
}

export interface RemoteInvoiceStatus extends RemoteInvoice {
  verifactuState: VerifactuState;
  verifactuDocumentId: string | null;
  qrValue: string | null;
  rejectionReason: string | null;
  pdfAvailable: boolean;
}

export interface RemoteInvoiceDraft {
  customerId: string;
  reference: string;
  lines: InvoiceLine[];
}

export interface InvoiceGateway {
  ensureCustomer(input: FiscalCustomerSnapshot): Promise<ExternalPartnerRef>;
  findInvoiceByReference(reference: string): Promise<RemoteInvoice | null>;
  createDraftInvoice(input: RemoteInvoiceDraft): Promise<RemoteInvoice>;
  postInvoice(externalInvoiceId: string): Promise<RemoteInvoice>;
  sendInvoice(externalInvoiceId: string): Promise<void>;
  getInvoice(externalInvoiceId: string): Promise<RemoteInvoiceStatus>;
  fetchInvoicePdf(externalInvoiceId: string): Promise<Buffer>;
}
