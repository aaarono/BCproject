import axios from "axios";

export const http = axios.create({
  baseURL: "http://localhost:3000",
});

const saved = localStorage.getItem("token");
if (saved) {
  http.defaults.headers.common.Authorization = `Bearer ${saved}`;
}

export function setAuthToken(token: string | null) {
  if (token) http.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete http.defaults.headers.common.Authorization;
}
