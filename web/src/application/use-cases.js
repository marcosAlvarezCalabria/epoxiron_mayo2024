import { apiClient } from "@/infrastructure/api/apiClient";
export const getCustomers = async () => apiClient("/api/customers");
export const getDeliveryNotes = async () => apiClient("/api/delivery-notes");
export const getDashboardSummary = async () => apiClient("/api/dashboard/summary");
export const createHermesSession = async () => apiClient("/api/hermes/sessions", {
    method: "POST"
});
export const getHermesSession = async (sessionId) => apiClient(`/api/hermes/sessions/${sessionId}`);
export const sendHermesMessage = async (sessionId, content) => apiClient(`/api/hermes/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content })
});
export const confirmHermesProposal = async (proposalId) => apiClient(`/api/hermes/proposals/${proposalId}/confirm`, {
    method: "POST"
});
export const rejectHermesProposal = async (proposalId) => apiClient(`/api/hermes/proposals/${proposalId}/reject`, {
    method: "POST"
});
export const getHermesTasks = async () => apiClient("/api/hermes/tasks");
