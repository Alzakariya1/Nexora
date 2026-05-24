import api from "./client";

export const portalApi = {
  patient: (params = {}) => api.get("/portal/patient", { params }),
  doctor: (params = {}) => api.get("/portal/doctor", { params }),
};
