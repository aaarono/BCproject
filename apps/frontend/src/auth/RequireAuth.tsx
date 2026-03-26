import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoadingState } from "../components/ui/PageStates";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();
  if (!isReady) {
    return <LoadingState width="max-w-4xl" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
