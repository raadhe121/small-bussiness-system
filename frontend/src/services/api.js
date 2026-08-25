import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bh_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes("/auth/login")) {
      localStorage.removeItem("bh_token");
      localStorage.removeItem("bh_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

/** Extracts a friendly message from an API error. */
export const errMsg = (err, fallback = "Something went wrong") =>
  err.response?.data?.message || err.message || fallback;

export const errFieldErrors = (err) => {
  const errs = {};
  for (const e of err.response?.data?.errors || []) errs[e.field] = e.message;
  return errs;
};

export default api;
