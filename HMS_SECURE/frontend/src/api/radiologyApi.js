import api from "./client";

export const radiologyApi = {
  list: (params) => api.get("/radiology/tests", { params }),
  create: (payload) => api.post("/radiology/tests", payload),
  updateStatus: (id, status) => api.patch(`/radiology/tests/${id}/status`, { status }),
  uploadReport: (id, payload) => api.patch(`/radiology/upload-report/${id}`, payload),
  saveReport: (id, payload) => api.patch(`/radiology/tests/${id}/report`, payload),
  approve: (id, payload = {}) => api.patch(`/radiology/tests/${id}/approve`, payload),
};
