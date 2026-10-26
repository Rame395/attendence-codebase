import axios from "axios";
import Cookies from "js-cookie";
import type { NavigateFunction } from "react-router-dom";

// router navigate function - Router.tsx bata set garinxa
let navigateFn: NavigateFunction | null = null;

export const setNavigate = (fn: NavigateFunction) => {
  navigateFn = fn;
};

// yo axios instance le backend sanga communication garxa
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_APP_BASE_URL,
  timeout: 60000,
  timeoutErrorMessage: "Server Timedout...",
  responseType: "json",
  headers: {
    "Content-Type": "application/json",
  },
});

// request interceptor - har request ma token attach garxa
axiosInstance.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }
  return config;
});

// response interceptor - response data unwrap garxa, error handle garxa
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (exception) => {
    if (exception.status === 401) {
      Cookies.remove("access_token");
      navigateFn?.("/login");
    }
    if (exception.status === 400 || exception.status === 422) {
      throw exception?.response?.data;
    }
    throw exception?.response;
  },
);

export default axiosInstance;
