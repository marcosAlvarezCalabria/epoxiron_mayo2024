import { apiClient } from "@/infrastructure/api/apiClient";
import type {
  Customer,
  CustomerInput,
  DashboardSummary,
  DailyDeliveryNotesReportResponse,
  DailyDeliveryNotesReportUploadsListResponse,
  DeliveryNote,
  DeliveryNotesListResponse,
  DeliveryNoteInput,
  DeliveryNoteItemDraft,
  DeliveryNoteStatus,
  PricePreview
} from "@/domain/entities";
import type { ParsedVoiceAlbaranData } from "@/features/voice/voiceAlbaran";

export interface ParsedVoiceAlbaranAudioResponse {
  transcript: string;
  parsed: ParsedVoiceAlbaranData;
}

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
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: DeliveryNoteStatus | "ALL";
  customerId?: string;
  today?: boolean;
  limit?: number;
  offset?: number;
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
  if (filters?.date) {
    params.set("date", filters.date);
  }
  if (filters?.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters?.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  if (typeof filters?.limit === "number") {
    params.set("limit", filters.limit.toString());
  }
  if (typeof filters?.offset === "number") {
    params.set("offset", filters.offset.toString());
  }
  const query = params.toString();
  return apiClient<DeliveryNotesListResponse>(
    `/api/delivery-notes${query ? `?${query}` : ""}`
  );
};

export const getDailyDeliveryNotesReportUploads = async (filters?: {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }
  if (filters?.dateTo) {
    params.set("dateTo", filters.dateTo);
  }
  if (typeof filters?.limit === "number") {
    params.set("limit", filters.limit.toString());
  }
  if (typeof filters?.offset === "number") {
    params.set("offset", filters.offset.toString());
  }

  const query = params.toString();
  return apiClient<DailyDeliveryNotesReportUploadsListResponse>(
    `/api/delivery-notes/report-uploads${query ? `?${query}` : ""}`
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

export const sendDailyDeliveryNotesReport = async (input?: { date?: string }) =>
  apiClient<DailyDeliveryNotesReportResponse>("/api/delivery-notes/send-daily-report", {
    method: "POST",
    body: JSON.stringify(input ?? {})
  });

export const parseVoiceAlbaran = async (transcript: string) =>
  apiClient<ParsedVoiceAlbaranData>("/api/voice/parse-albaran", {
    method: "POST",
    body: JSON.stringify({ transcript })
  });

export const parseVoiceAlbaranAudio = async (audio: Blob) => {
  const formData = new FormData();
  formData.set("audio", audio, "voice-input.webm");

  return apiClient<ParsedVoiceAlbaranAudioResponse>("/api/voice/parse-albaran-audio", {
    method: "POST",
    body: formData
  });
};
