import api from "./client";

export const patientApi = {
  list: () => api.get("/patients"),
  create: (payload) => api.post("/patients", payload),
  update: (id, payload) => api.put(`/patients/${id}`, payload),
  delete: (id) => api.delete(`/patients/${id}`),
  timeline: (id) => api.get(`/patients/${id}/timeline`),
  uploadProfileImage: (id, formData) =>
    api.post(`/patients/${id}/profile-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  uploadDocument: (id, formData) =>
    api.post(`/patients/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};
