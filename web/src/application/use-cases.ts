import { apiClient } from "@/infrastructure/api/apiClient";
import type {
  Customer,
  CustomerInput,
  DashboardSummary,
  DeliveryNote,
  DeliveryNoteInput,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus,
  HermesSession,
  HermesTask,
  PricePreview
} from "@/domain/entities";

export const getCustomers = async (search?: string) =>
  apiClient<{ customers: Customer[] }>(
    `/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`
  );

export const createCustomer = async (input: CustomerInput) =>
  apiClient<{ customer: Customer }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input)
  });

export const updateCustomer = async (id: string, input: CustomerInput) =>
  apiClient<{ customer: Customer }>(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });

export const deleteCustomer = async (id: string) =>
  apiClient<void>(`/api/customers/${id}`, {
    method: "DELETE"
  });

export const getDeliveryNotes = async (filters?: {
  status?: DeliveryNoteStatus | "ALL";
  customerId?: string;
  today?: boolean;
}) => {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }
  if (filters?.customerId) {
    params.set("customerId", filters.customerId);
  }
  if (filters?.today) {
    params.set("today", "true");
  }
  const query = params.toString();
  return apiClient<{ deliveryNotes: DeliveryNote[] }>(
    `/api/delivery-notes${query ? `?${query}` : ""}`
  );
};

export const createDeliveryNote = async (input: DeliveryNoteInput) =>
  apiClient<{ deliveryNote: DeliveryNote }>("/api/delivery-notes", {
    method: "POST",
    body: JSON.stringify(input)
  });

export const updateDeliveryNote = async (id: string, input: DeliveryNoteInput) =>
  apiClient<{ deliveryNote: DeliveryNote }>(`/api/delivery-notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });

export const deleteDeliveryNote = async (id: string) =>
  apiClient<void>(`/api/delivery-notes/${id}`, {
    method: "DELETE"
  });

export const updateDeliveryNoteStatus = async (id: string, status: DeliveryNoteStatus) =>
  apiClient<{ deliveryNote: DeliveryNote }>(`/api/delivery-notes/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });

export const calculatePricePreview = async (customerId: string, item: DeliveryNoteItemDraft) =>
  apiClient<PricePreview>("/api/delivery-notes/calculate-price", {
    method: "POST",
    body: JSON.stringify({ customerId, item })
  });

export const getDashboardSummary = async () =>
  apiClient<DashboardSummary>("/api/dashboard/summary");

export const createHermesSession = async () =>
  apiClient<{ sessionId: string; createdAt: string }>("/api/hermes/sessions", {
    method: "POST"
  });

export const getHermesSession = async (sessionId: string) =>
  apiClient<HermesSession>(`/api/hermes/sessions/${sessionId}`);

export const sendHermesMessage = async (sessionId: string, content: string) =>
  apiClient<HermesSession>(`/api/hermes/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content })
  });

export const confirmHermesProposal = async (proposalId: string) =>
  apiClient<{ status: string }>(`/api/hermes/proposals/${proposalId}/confirm`, {
    method: "POST"
  });

export const rejectHermesProposal = async (proposalId: string) =>
  apiClient<{ status: string }>(`/api/hermes/proposals/${proposalId}/reject`, {
    method: "POST"
  });

export const getHermesTasks = async () =>
  apiClient<{ tasks: HermesTask[] }>("/api/hermes/tasks");
