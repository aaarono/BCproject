import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const http = axios.create({
  baseURL: apiUrl,
});

const saved = localStorage.getItem("token");
if (saved) {
  http.defaults.headers.common.Authorization = `Bearer ${saved}`;
}

export function setAuthToken(token: string | null) {
  if (token) http.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete http.defaults.headers.common.Authorization;
}
