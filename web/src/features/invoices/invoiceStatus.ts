import type { Invoice } from "@/features/invoices/invoiceTypes";

export const invoiceNeedsPolling = (invoice: Invoice): boolean =>
  invoice.localState === "CREATING" ||
  invoice.localState === "CREATED_REMOTE" ||
  invoice.localState === "RECONCILING" ||
  invoice.verifactuState === "PENDING";

export const invoiceCanReconcile = (invoice: Invoice): boolean =>
  invoice.localState !== "FAILED" || invoice.externalInvoiceId !== null;

export const invoiceHasCustomerDataRejection = (invoice: Invoice): boolean =>
  invoice.lastErrorCode?.startsWith("ODOO_REJECTED_CUSTOMER_") ?? false;
