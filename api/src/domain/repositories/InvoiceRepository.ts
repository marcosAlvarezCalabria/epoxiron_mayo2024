import type {
  FiscalCustomerSnapshot,
  Invoice,
  InvoiceLine,
  InvoiceLocalState,
  OdooMoveState,
  ReservedInvoice,
  VerifactuState
} from "../entities/Invoice.js";
import type { Money } from "../services/invoiceMoney.js";

export interface ReserveInvoiceInput {
  deliveryNoteIds: string[];
  idempotencyKey: string;
  remoteReference: string;
  series: string | null;
  taxRate: string;
}

export interface InvoicePatch {
  localState?: InvoiceLocalState;
  odooMoveState?: OdooMoveState | null;
  verifactuState?: VerifactuState;
  externalInvoiceId?: string | null;
  number?: string | null;
  subtotal?: Money;
  taxAmount?: Money;
  total?: Money;
  verifactuDocumentId?: string | null;
  verifactuQrValue?: string | null;
  pdfAvailable?: boolean;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  reconciliationAttempts?: number;
  nextReconciliationAt?: Date | null;
}

export interface InvoiceRepository {
  reserve(input: ReserveInvoiceInput): Promise<ReservedInvoice>;
  findById(id: string): Promise<Invoice | null>;
  findByIdempotencyKey(key: string): Promise<Invoice | null>;
  findDueForReconciliation(now: Date, limit: number): Promise<Invoice[]>;
  update(id: string, patch: InvoicePatch): Promise<Invoice>;
  markLinked(id: string, patch: InvoicePatch): Promise<Invoice>;
  acquireReconciliationLease(id: string, now: Date, leaseUntil: Date): Promise<boolean>;
  releaseReconciliationLease(id: string): Promise<void>;
  updateCustomerExternalPartnerId(customerId: string, externalPartnerId: string): Promise<void>;
}

export interface InvoiceSnapshotDraft {
  customer: FiscalCustomerSnapshot;
  lines: InvoiceLine[];
  subtotal: Money;
  taxAmount: Money;
  total: Money;
}
