import api from "./client";

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  getUsers: () => api.get("/auth/users"),
  getPermissions: () => api.get("/auth/permissions"),
  updateProfile: (payload) => api.put("/auth/me", payload),
  changePassword: (payload) => api.put("/auth/change-password", payload),
  createUser: (payload) => api.post("/auth/users", payload),
  updateUserStatus: (id, status) => api.patch(`/auth/users/${id}`, { status }),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
};
