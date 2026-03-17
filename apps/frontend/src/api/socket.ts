import { io, Socket } from "socket.io-client";

const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;

  socket = io(wsUrl, {
    autoConnect: true,
    withCredentials: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}