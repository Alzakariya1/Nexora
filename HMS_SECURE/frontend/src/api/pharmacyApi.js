import api from "./client";

export const pharmacyApi = {
  list: () => api.get("/pharmacy/medicines"),
  create: (payload) => api.post("/pharmacy/medicines", payload),
  update: (id, payload) => api.put(`/pharmacy/medicines/${id}`, payload),
  archive: (id, reason) => api.delete(`/pharmacy/medicines/${id}`, { data: { reason } }),
  adjustStock: (id, payload) => api.patch(`/pharmacy/medicines/${id}/stock`, payload),
  lowStock: () => api.get("/pharmacy/low-stock"),
  summary: () => api.get("/pharmacy/summary"),
  sales: (params = {}) => api.get("/pharmacy/sales", { params }),
  createSale: (payload) => api.post("/pharmacy/sales", payload),
  dispensePrescription: (payload) => api.post("/pharmacy/dispense-prescription", payload),
};
