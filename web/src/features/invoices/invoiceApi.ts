import { apiBlob, apiClient } from "@/infrastructure/api/apiClient";
import type { Invoice, InvoiceListResponse, InvoicePreviewResponse } from "./invoiceTypes";

export const listInvoices = async (): Promise<InvoiceListResponse> =>
  apiClient<InvoiceListResponse>("/api/invoices");

export const previewInvoice = async (deliveryNoteIds: string[]) =>
  apiClient<InvoicePreviewResponse>("/api/invoices/preview", {
    method: "POST",
    body: JSON.stringify({ deliveryNoteIds })
  });

export const createInvoice = async ({
  deliveryNoteIds,
  previewToken
}: {
  deliveryNoteIds: string[];
  previewToken: string;
}) =>
  apiClient<{ invoice: Invoice; created: boolean }>("/api/invoices", {
    method: "POST",
    body: JSON.stringify({ deliveryNoteIds, confirmed: true, previewToken })
  });

export const reconcileInvoice = async (id: string) =>
  apiClient<{ invoice: Invoice }>(`/api/invoices/${id}/reconcile`, { method: "POST" });

export const downloadInvoicePdf = async (invoice: Invoice): Promise<void> => {
  const blob = await apiBlob(`/api/invoices/${invoice.id}/pdf`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.number ?? `factura-${invoice.id}`}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
