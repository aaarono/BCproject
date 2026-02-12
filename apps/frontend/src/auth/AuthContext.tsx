import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { http, setAuthToken } from "../api/http";

type User = { id: string; email: string; role: "BUYER" | "SELLER" | "ADMIN" };

type AuthState = {
  token: string | null;
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  isReady: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    refreshMe().catch(() => logout());
  }, [token]);

  async function refreshMe() {
    if (!token) return;
    const res = await http.get<User>("/auth/me");
    setUser(res.data);
  }

  async function login(newToken: string) {
    localStorage.setItem("token", newToken);
    setAuthToken(newToken);
    setToken(newToken);

    const res = await http.get<User>("/auth/me");
    setUser(res.data);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }

  useEffect(() => {
    (async () => {
      if (!token) {
        setIsReady(true);
        return;
      }
      try {
        await refreshMe();
      } catch {
        logout();
      } finally {
        setIsReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ token, user, login, logout, refreshMe, isReady }),
    [token, user, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
