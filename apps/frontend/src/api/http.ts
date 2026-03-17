import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const http = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
});
