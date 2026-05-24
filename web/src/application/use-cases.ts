import { apiClient } from "@/infrastructure/api/apiClient";
import type { Customer, DashboardSummary, DeliveryNote, HermesSession, HermesTask } from "@/domain/entities";

export const getCustomers = async () =>
  apiClient<{ customers: Customer[] }>("/api/customers");

export const getDeliveryNotes = async () =>
  apiClient<{ deliveryNotes: DeliveryNote[] }>("/api/delivery-notes");

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

