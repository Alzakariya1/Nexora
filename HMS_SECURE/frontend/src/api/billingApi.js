import api from "./client";

export const billingApi = {
  list: () => api.get("/billing/all"),
  create: (payload) => api.post("/billing", payload),
};
