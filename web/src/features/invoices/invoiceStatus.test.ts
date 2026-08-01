import { describe, expect, it } from "vitest";
import type { Invoice } from "@/features/invoices/invoiceTypes";
import {
  invoiceCanReconcile,
  invoiceHasCustomerDataRejection,
  invoiceNeedsPolling
} from "@/features/invoices/invoiceStatus";

const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "invoice-1",
  number: null,
  customer: {
    customerId: "customer-1",
    legalName: "Cliente SL",
    vat: "B12345678"
  },
  subtotal: "10.00",
  taxAmount: "2.10",
  total: "12.10",
  localState: "FAILED",
  verifactuState: "NOT_SENT",
  externalInvoiceId: null,
  pdfAvailable: false,
  lastErrorCode: "ODOO_REJECTED_CUSTOMER_HTTP_400",
  lastErrorMessage: "Odoo ha rechazado los datos fiscales del cliente.",
  deliveryNoteIds: ["note-1"],
  createdAt: "2026-07-26T00:00:00.000Z",
  ...overrides
});

describe("invoice status helpers", () => {
  it("does not poll or reconcile a definitive pre-remote rejection", () => {
    const rejected = invoice();

    expect(invoiceNeedsPolling(rejected)).toBe(false);
    expect(invoiceCanReconcile(rejected)).toBe(false);
    expect(invoiceHasCustomerDataRejection(rejected)).toBe(true);
  });

  it("allows reconciliation when a remote invoice exists", () => {
    expect(invoiceCanReconcile(invoice({ externalInvoiceId: "42" }))).toBe(true);
  });

  it("keeps polling recoverable reconciliation states", () => {
    expect(invoiceNeedsPolling(invoice({
      localState: "RECONCILING",
      lastErrorCode: "ODOO_TIMEOUT"
    }))).toBe(true);
  });
});
