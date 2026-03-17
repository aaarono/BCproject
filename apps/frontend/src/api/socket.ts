import { io, Socket } from "socket.io-client";

const wsUrl = import.meta.env.VITE_WS_URL ?? "http://localhost:3000";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(token: string) {
  if (socket && socketToken === token) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;

  socket = io(wsUrl, {
    autoConnect: true,
    auth: { token },
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}