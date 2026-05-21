import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const refreshToken = localStorage.getItem("refreshToken");
    const isAuthRefresh = original.url?.includes("/auth/refresh-token");

    if (status === 401 && refreshToken && !original._retry && !isAuthRefresh) {
      original._retry = true;
      try {
        refreshPromise ||= api.post("/auth/refresh-token", { refreshToken });
        const { data } = await refreshPromise;
        refreshPromise = null;
        localStorage.setItem("token", data.token);
        localStorage.setItem("refreshToken", data.refreshToken);
        if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
