import api from "./client";

export const labApi = {
  list: (params) => api.get("/lab/tests", { params }),
  create: (payload) => api.post("/lab/tests", payload),
  updateStatus: (id, status) => api.patch(`/lab/tests/${id}/status`, { status, test_status: status }),
  uploadReport: (id, payload) => api.patch(`/lab/upload-report/${id}`, payload),
  saveResults: (id, payload) => api.patch(`/lab/tests/${id}/results`, payload),
  approve: (id, payload = {}) => api.patch(`/lab/tests/${id}/approve`, payload),
  templates: () => api.get("/lab/templates"),
  createTemplate: (payload) => api.post("/lab/templates", payload),
  updateTemplate: (id, payload) => api.put(`/lab/templates/${id}`, payload),
  machineOrders: () => api.get("/lab/machine-api/orders"),
};
