import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
