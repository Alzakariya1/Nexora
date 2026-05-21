import api from "./client";

export const billingApi = {
  list: () => api.get("/billing/all"),
  summary: () => api.get("/billing/summary"),
  get: (id) => api.get(`/billing/${id}`),
  create: (payload) => api.post("/billing", payload),
  update: (id, payload) => api.put(`/billing/${id}`, payload),
  updatePayment: (id, payload) => api.patch(`/billing/${id}/payment`, payload),
  cancel: (id, reason) => api.patch(`/billing/${id}/cancel`, { reason }),
  archive: (id, reason) => api.delete(`/billing/${id}`, { data: { reason } }),
  pdfUrl: (id) => `${api.defaults.baseURL}/billing/invoice/${id}/pdf`,
};
