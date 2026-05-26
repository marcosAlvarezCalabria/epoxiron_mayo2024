import { apiClient } from "@/infrastructure/api/apiClient";
export const getCustomers = async (search) => apiClient(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`);
export const createCustomer = async (input) => apiClient("/api/customers", {
    method: "POST",
    body: JSON.stringify(input)
});
export const updateCustomer = async (id, input) => apiClient(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
});
export const deleteCustomer = async (id) => apiClient(`/api/customers/${id}`, {
    method: "DELETE"
});
export const getDeliveryNotes = async (filters) => {
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
    return apiClient(`/api/delivery-notes${query ? `?${query}` : ""}`);
};
export const createDeliveryNote = async (input) => apiClient("/api/delivery-notes", {
    method: "POST",
    body: JSON.stringify(input)
});
export const updateDeliveryNote = async (id, input) => apiClient(`/api/delivery-notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
});
export const deleteDeliveryNote = async (id) => apiClient(`/api/delivery-notes/${id}`, {
    method: "DELETE"
});
export const updateDeliveryNoteStatus = async (id, status) => apiClient(`/api/delivery-notes/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
});
export const calculatePricePreview = async (customerId, item) => apiClient("/api/delivery-notes/calculate-price", {
    method: "POST",
    body: JSON.stringify({ customerId, item })
});
export const getDashboardSummary = async () => apiClient("/api/dashboard/summary");
