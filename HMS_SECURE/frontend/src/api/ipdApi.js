import api from "./client";

export const ipdApi = {
  list: (params = {}) => api.get("/ipd", { params }),
  admit: (payload) => api.post("/ipd/admit", payload),
  updateStatus: (id, payload) => api.patch(`/ipd/${id}/status`, payload),
  transferBed: (id, payload) => api.patch(`/ipd/${id}/transfer-bed`, payload),
  discharge: (payload) => api.post("/ipd/discharge", payload),
  archive: (id, reason) => api.delete(`/ipd/${id}`, { data: { reason } }),
  nursingNotes: (id) => api.get(`/ipd/${id}/nursing-notes`),
  addNursingNote: (payload) => api.post("/ipd/nursing-notes", payload),
};
