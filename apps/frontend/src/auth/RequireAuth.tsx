import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="p-6">Loading…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
