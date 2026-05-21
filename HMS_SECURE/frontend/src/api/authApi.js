import api from "./client";

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  getUsers: () => api.get("/auth/users"),
  getPermissions: () => api.get("/auth/permissions"),
  getRoles: () => api.get("/auth/roles"),
  updateProfile: (payload) => api.put("/auth/me", payload),
  changePassword: (payload) => api.put("/auth/change-password", payload),
  refreshToken: (refreshToken) => api.post("/auth/refresh-token", { refreshToken }),
  logout: () => api.post("/auth/logout"),
  logoutAll: () => api.post("/auth/logout-all"),
  sessions: () => api.get("/auth/sessions"),
  createUser: (payload) => api.post("/auth/users", payload),
  updateUser: (id, payload) => api.patch(`/auth/users/${id}`, payload),
  updateUserStatus: (id, status) => api.patch(`/auth/users/${id}`, { status }),
  deactivateUser: (id, reason) => api.delete(`/auth/users/${id}`, { data: { reason } }),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};
